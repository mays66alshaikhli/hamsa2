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
  const [reply, setReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
    createThread();
    setupVoiceInput();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const setupVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return console.warn("SpeechRecognition not supported");

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const spoken = event.results[0][0].transcript;
      setMessage(spoken);
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
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );
      setThreadId(response.data.id);
    } catch (err) {
      console.error("Thread creation failed", err);
    }
  };

  const sendMessage = async (customMessage?: string) => {
    const content = customMessage || message;
    if (!content) return;

    setLoading(true);
    try {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        const response = await axios.post(
          "https://api.openai.com/v1/threads",
          {},
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "OpenAI-Beta": "assistants=v2",
            },
          }
        );
        currentThreadId = response.data.id;
        setThreadId(currentThreadId);
      }

      setMessages((prev) => [...prev, { role: "user", content }]);
      setMessage("");

      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { role: "user", content },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const run = await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
        { assistant_id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      let runStatus = "in_progress";
      while (runStatus !== "completed") {
        await new Promise((res) => setTimeout(res, 2000));
        const status = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${run.data.id}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "OpenAI-Beta": "assistants=v2",
            },
          }
        );
        runStatus = status.data.status;
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

      const replyText = msgRes.data.data.find((msg: any) => msg.role === "assistant")
        ?.content?.[0]?.text?.value || "لم أفهم ذلك.";
      setReply(replyText);

      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);

      const cleanedReply = replyText.replace(/[^\p{Letter}\p{Number}\s،؟.!؟]/gu, "");
      speakText(cleanedReply);
    } catch (err) {
      console.error("Send failed", err);
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
            أنا همسة، صديقتك الإفتراضية ، مرحباً بك 
أخبريني ماذا تريدين أن نفعل اليوم ؟
          </h2>

          <div className="flex justify-center mb-6">
            <Image src="/hamsah.gif" alt="Bot" width={200} height={200} className="rounded-lg" />
          </div>

          {messages.length > 0 && (
            <div className="mb-6 bg-gray-100 rounded-lg border border-gray-200 shadow-sm text-black">
              <div className="max-h-96 overflow-y-auto p-6">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 my-2 rounded-lg ${
                      msg.role === "user"
                        ? "bg-red-100 text-right ml-12"
                        : "bg-gray-200 text-right mr-12"
                    }`}
                  >
                    <strong className="text-red-900">
                      {msg.role === "user" ? "أنت: " : "همسة: "}
                    </strong>
                    <span>{msg.content}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 text-gray-700 resize-none min-h-[120px]"
              placeholder="اكتب رسالتك هنا..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              dir="rtl"
            />

            <div className="flex flex-col gap-3 mt-4">
              <button
                onClick={() => recognitionRef.current?.start()}
                className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                🎤 ابدأ بالتحدث
              </button>

              <button
                onClick={() => sendMessage()}
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white ${
                  loading
                    ? "bg-red-800 cursor-not-allowed"
                    : "bg-red-900 hover:bg-red-800 active:bg-red-700"
                }`}
              >
                {loading ? "قيد المعالجة..." : "ارسل الرسالة"}
              </button>

              {reply && (
                <button
                  onClick={() => {
                    const cleanedReply = reply.replace(/[^\p{Letter}\p{Number}\s،؟.!؟]/gu, "");
                    speakText(cleanedReply);
                  }}
                  className="w-full py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  🔊 اضغط هنا للاستماع
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}