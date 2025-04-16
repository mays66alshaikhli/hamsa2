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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createThread();
    setupVoiceInput();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const setupVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in your browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setMessage(result);
      sendMessage(result);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  };

  const speakText = (text: string) => {
    return new Promise((resolve) => {
      if (!text) {
        resolve(false);
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = /[أ-ي]/.test(text) ? "ar-SA" : "en-US";
      utterance.volume = 1;
      utterance.rate = 0.9; // Slightly slower for better comprehension
      utterance.pitch = 1;

      utterance.onend = () => {
        resolve(true);
      };

      utterance.onerror = (event) => {
        console.error("SpeechSynthesis error", event);
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    });
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
    if (!text || !threadId) return;

    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      // Send user message
      await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/messages`,
        { role: "user", content: text },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      // Create a run
      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/runs`,
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
      let status = runRes.data.status;

      // Poll for completion
      while (status !== "completed" && status !== "failed") {
        await new Promise((res) => setTimeout(res, 1000));
        const statusRes = await axios.get(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
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

      if (status === "failed") {
        throw new Error("Run failed");
      }

      // Get the assistant's response
      const messageRes = await axios.get(
        `https://api.openai.com/v1/threads/${threadId}/messages`,
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
      
      // Speak the assistant's response
      await speakText(reply);
    } catch (error) {
      console.error("Message sending failed:", error);
      const errorMsg = "حدث خطأ في الاتصال بالمساعد. يرجى المحاولة مرة أخرى.";
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      await speakText(errorMsg);
    } finally {
      setLoading(false);
      setMessage("");
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
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
            {loading && (
              <div className="text-center p-2">
                <div className="animate-pulse">همسة تفكر...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="text-center">
            <button
              onClick={toggleListening}
              className={`${
                isListening ? "bg-red-900" : "bg-red-700 hover:bg-red-800"
              } text-white py-3 px-6 rounded-full font-semibold shadow-md transition duration-200 flex items-center justify-center mx-auto`}
              disabled={loading}
            >
              {isListening ? (
                <>
                  <span className="relative flex h-3 w-3 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  يتوقف عن الاستماع...
                </>
              ) : (
                <>
                  🎤 اضغط للحديث مع همسة
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
