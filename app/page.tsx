"use client";

import { useEffect, useRef } from "react";
import axios from "axios";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function Home() {
  const recognitionRef = useRef<any>(null);
  const threadIdRef = useRef<string | null>(null);

  useEffect(() => {
    createThread();
    setupVoiceInput();
  }, []);

  const setupVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA"; // Or "en-US"
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const spokenText = event.results[0][0].transcript;
      sendMessage(spokenText);
    };

    recognition.onend = () => {
      recognition.start(); // Keep listening continuously
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[أ-ي]/.test(text) ? "ar-SA" : "en-US";
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel(); // Stop any ongoing speech
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
      threadIdRef.current = response.data.id;
    } catch (err) {
      console.error("Thread creation failed", err);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message || !threadIdRef.current) return;

    try {
      await axios.post(
        `https://api.openai.com/v1/threads/${threadIdRef.current}/messages`,
        { role: "user", content: message },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${threadIdRef.current}/runs`,
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

      let runStatus = "in_progress";
      while (runStatus !== "completed") {
        await new Promise((res) => setTimeout(res, 2000));
        const check = await axios.get(
          `https://api.openai.com/v1/threads/${threadIdRef.current}/runs/${runId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "Content-Type": "application/json",
              "OpenAI-Beta": "assistants=v2",
            },
          }
        );
        runStatus = check.data.status;
      }

      const messagesRes = await axios.get(
        `https://api.openai.com/v1/threads/${threadIdRef.current}/messages`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const assistantMessage = messagesRes.data.data.find((msg: any) => msg.role === "assistant");
      if (assistantMessage) {
        const reply = assistantMessage.content[0].text.value;
        speakText(reply);
      }
    } catch (err) {
      console.error("Error during sendMessage", err);
      speakText("حدث خطأ أثناء الاتصال بالمساعد.");
    }
  };

  return null; // No UI needed, it's voice only
}
