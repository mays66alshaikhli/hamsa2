"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Image from "next/image";

export default function Home() {
  // if (typeof window === "undefined") return null; // 🛑 Prevent SSR

  // const [message, setMessage] = useState("");
  // const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  // const [threadId, setThreadId] = useState<string | null>(null);
  // const [loading, setLoading] = useState(false);
  // const messagesEndRef = useRef<HTMLDivElement>(null);
  // const recognitionRef = useRef<any>(null); // ✅ Avoid SSR type error

  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // };

  // useEffect(() => {
  //   createThread();
  //   setupVoiceInput(); // 👈 Init on client only
  // }, []);

  // useEffect(() => {
  //   scrollToBottom();
  // }, [messages]);

  // const setupVoiceInput = () => {
  //   const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  //   if (SpeechRecognition) {
  //     const recognition = new SpeechRecognition();
  //     recognition.lang = "ar-SA";
  //     recognition.interimResults = false;
  //     recognition.maxAlternatives = 1;

  //     recognition.onresult = (event: SpeechRecognitionEvent) => {
  //       const result = event.results[0][0].transcript;
  //       setMessage(result);
  //     };

  //     recognitionRef.current = recognition;
  //   } else {
  //     console.warn("Speech recognition not supported.");
  //   }
  // };
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
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "ar-SA";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[0][0].transcript;
        setMessage(result);
      };

      recognitionRef.current = recognition;
    }
  };

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[أ-ي]/.test(text) ? "ar-SA" : "en-US"; // Detect Arabic
    window.speechSynthesis.speak(utterance);
  };

  const createThread = async () => {
    try {
      const threadResponse = await axios.post(
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
      setThreadId(threadResponse.data.id);
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  };

  const sendMessage = async () => {
    if (!message) return;
    setLoading(true);

    try {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        const threadResponse = await axios.post(
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
        currentThreadId = threadResponse.data.id;
        setThreadId(currentThreadId);
      }

      setMessages((prevMessages) => [...prevMessages, { role: "user", content: message }]);

      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { role: "user", content: message },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const runResponse = await axios.post(
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

      const runId = runResponse.data.id;

      let runStatus = "in_progress";
      while (runStatus !== "completed") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusResponse = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "OpenAI-Beta": "assistants=v2",
            },
          }
        );
        runStatus = statusResponse.data.status;
      }

      const messagesResponse = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const assistantMessages = messagesResponse.data.data.filter(
        (msg: any) => msg.role === "assistant"
      );

      let textResponse = "No response from assistant.";
      if (assistantMessages.length > 0) {
        textResponse = assistantMessages[0].content[0].text.value;

        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "assistant", content: textResponse },
        ]);

        speakText(textResponse); // ✅ Speak reply
      }

    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error("API Error:", err.response?.data || err.message || "Unknown error");

      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", content: "Error: Could not connect to AI assistant." },
      ]);
    }

    setLoading(false);
    setMessage("");
  };

  if (!isMounted) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-purple-100 to-pink-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
            صديقتك همسة -روبوتك الافتراضي- مرحباً بك
          </h2>

          <div className="flex justify-center mb-6">
            <Image
              src="/hamsah.gif"
              alt="AI Chat Bot"
              width={200}
              height={200}
              className="rounded-lg"
            />
          </div>

          {messages.length > 0 && (
            <div className="mb-6 bg-gray-100 rounded-lg border border-gray-200 shadow-sm text-black">
              <div className="max-h-96 overflow-y-auto p-6">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 my-2 rounded-lg ${
                      msg.role === "user"
                        ? "bg-red-100 text-right ml-12"
                        : "bg-gray-200 text-right mr-12"
                    }`}
                  >
                    <strong className="text-red-900">
                      {msg.role === "user" ? "أنت: " : "همسة: "}
                    </strong>
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-700 resize-none transition-all duration-200 ease-in-out min-h-[120px]"
              placeholder="اكتب رسالتك هنا..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              dir="rtl"
            />

            <button
              type="button"
              onClick={() => recognitionRef.current?.start()}
              className="text-sm text-blue-600 mt-2 underline"
            >
              🎤 اضغط للتحدث بدلاً من الكتابة
            </button>

            <button
              className={`mt-4 w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 ease-in-out ${
                loading
                  ? "bg-red-800 cursor-not-allowed"
                  : "bg-red-900 hover:bg-red-900 active:bg-red-700"
              }`}
              onClick={sendMessage}
              disabled={loading || !threadId}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  قيد المعالجة ...
                </span>
              ) : (
                "ارسل الرسالة"
              )}
            </button>
          </div>
        </div>
        <div className="fixed bottom-4 left-4 text-gray-400 text-[10px] font-semibold">
          Developer Name: Dr. Mays Alshaikhli (Contact: mays.alshaikhli@gmail.com)
        </div>
      </div>
    </div>
  );
}
