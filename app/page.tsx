"use client";

import { useEffect, useRef } from "react";
import axios from "axios";

export default function Home() {
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const spokenText = event.results[0][0].transcript;
      sendToOpenAI(spokenText);
    };

    recognitionRef.current = recognition;
  }, []);

  const sendToOpenAI = async (message: string) => {
    try {
      const threadRes = await axios.post(
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
      const threadId = threadRes.data.id;

      await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/messages`,
        { role: "user", content: message },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );

      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/runs`,
        { assistant_id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );

      const runId = runRes.data.id;

      let status = "in_progress";
      while (status !== "completed") {
        await new Promise((res) => setTimeout(res, 2000));
        const check = await axios.get(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "OpenAI-Beta": "assistants=v2",
              "Content-Type": "application/json",
            },
          }
        );
        status = check.data.status;
      }

      const messagesRes = await axios.get(
        `https://api.openai.com/v1/threads/${threadId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );

      const reply =
        messagesRes.data.data.find((msg: any) => msg.role === "assistant")
          ?.content?.[0]?.text?.value || "لم أفهم ذلك.";

      speak(reply);
    } catch (err) {
      console.error("Error:", err);
      speak("حدث خطأ أثناء الاتصال بالمساعد.");
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[أ-ي]/.test(text) ? "ar-SA" : "en-US";
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const startMic = () => recognitionRef.current?.start();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <button
        onClick={startMic}
        className="px-6 py-4 bg-red-600 text-white text-xl font-bold rounded-lg shadow-lg hover:bg-red-700"
      >
        🎤 اضغط للتحدث مع همسة
      </button>
    </div>
  );
}
