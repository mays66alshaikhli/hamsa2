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
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createThread();
    setupVoiceInput();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const setupVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported");

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setMessage(result);
      sendMessage(result);
    };

    recognitionRef.current = recognition;
  };

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[أ-ي]/.test(text) ? "ar-SA" : "en-US";
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const createThread = async () => {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/threads",
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );
      setThreadId(response.data.id);
    } catch (err) {
      console.error("Thread creation error:", err);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text) return;

    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const currentThreadId = threadId!;
      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { role: "user", content: text },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
        { assistant_id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const runId = runRes.data.id;
      let status = "in_progress";

      while (status !== "completed") {
        await new Promise((res) => setTimeout(res, 2000));
        const statusRes = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "Content-Type": "application/json",
              "OpenAI-Beta": "assistants=v2",
            },
          }
        );
        status = statusRes.data.status;
      }

      const messageRes = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const assistantMsgs = messageRes.data.data.filter((m: any) => m.role === "assistant");
      const reply = assistantMsgs[0]?.content[0]?.text?.value ?? "No response";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speakText(reply);
    } catch (error) {
      console.error("Message sending failed:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "حدث خطأ في الاتصال بالمساعد." }]);
    }

    setLoading(false);
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-purple-100 to-pink-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
            صديقتك همسة - روبوتك الافتراضي - مرحباً بك
          </h2>

          <div className="flex justify-center mb-6">
            <Image src="/hamsah.gif" alt="AI Bot" width={200} height={200} className="rounded-lg" />
          </div>

          <div className="bg-gray-100 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`my-2 p-2 rounded ${
                  msg.role === "user" ? "bg-red-100 text-right" : "bg-gray-300 text-right"
                }`}
              >
                <strong>{msg.role === "user" ? "أنت: " : "همسة: "}</strong> {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="text-center">
            <button
              onClick={() => recognitionRef.current?.start()}
              className="bg-red-700 hover:bg-red-800 text-white py-3 px-6 rounded-full font-semibold shadow-md transition duration-200"
              disabled={loading}
            >
              🎤 اضغط للحديث مع همسة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
