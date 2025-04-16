"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Image from "next/image";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setIsMounted(true);
    createThread();
    setupVoiceInput();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const setupVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice recognition not supported");

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setMessage(result);
      sendMessage(result); // Auto-send
    };

    recognitionRef.current = recognition;
  };

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[أ-ي]/.test(text) ? "ar-SA" : "en-US";
    utterance.rate = 1;
    utterance.volume = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const createThread = async () => {
    try {
      const res = await axios.post(
        "https://api.openai.com/v1/threads",
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );
      setThreadId(res.data.id);
    } catch (e) {
      console.error("Thread creation failed", e);
    }
  };

  const sendMessage = async (msg?: string) => {
    const input = msg ?? message;
    if (!input) return;

    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setMessage("");

    try {
      const currentThreadId = threadId;
      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { role: "user", content: input },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );

      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
        { assistant_id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );

      let status = "in_progress";
      while (status !== "completed") {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runRes.data.id}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "OpenAI-Beta": "assistants=v2",
            },
          }
        );
        status = statusRes.data.status;
      }

      const msgRes = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const assistantMsg = msgRes.data.data.find((m: any) => m.role === "assistant");
      const text = assistantMsg?.content?.[0]?.text?.value || "No response from assistant";

      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      speakText(text);
    } catch (e) {
      console.error("Send error", e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "حدث خطأ أثناء الاتصال بالمساعد." },
      ]);
    }

    setLoading(false);
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-purple-100 to-pink-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
            صديقتك همسة - روبوتك الافتراضي
          </h2>

          <div className="flex justify-center mb-6">
            <Image src="/hamsah.gif" alt="Bot" width={200} height={200} />
          </div>

          <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-y-auto">
            {messages.map((msg, idx) => (
              <div key={idx} className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                <span className="font-semibold">{msg.role === "user" ? "أنت" : "همسة"}:</span>{" "}
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef}></div>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full mt-4 p-3 border rounded-lg"
            placeholder="اكتب رسالتك..."
            dir="rtl"
          />

          <div className="flex gap-3 mt-3">
            <button
              onClick={() => recognitionRef.current?.start()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              🎤 تحدث الآن
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
            >
              {loading ? "قيد المعالجة..." : "ارسل"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
