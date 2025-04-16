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
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "ar-SA";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const result = event.results[0][0].transcript;
        setMessage(result);
        sendMessage(result); // Auto-send after voice input
      };

      recognition.onend = () => recognition.start(); // Keep listening
      recognitionRef.current = recognition;
      recognition.start(); // Start listening
    }
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

  const sendMessage = async (inputMessage: string) => {
    if (!inputMessage) return;
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

      setMessages((prevMessages) => [...prevMessages, { role: "user", content: inputMessage }]);

      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { role: "user", content: inputMessage },
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

      if (assistantMessages.length > 0) {
        const textResponse = assistantMessages[0].content[0].text.value;
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "assistant", content: textResponse },
        ]);
        speakText(textResponse);
      }
    } catch (error: any) {
      console.error("Error:", error);
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
            صديقتك همسة - روبوتك الافتراضي
          </h2>

          <div className="flex justify-center mb-6">
            <Image src="/hamsah.gif" alt="AI Bot" width={200} height={200} />
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
                    {msg.content}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
