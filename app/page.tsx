"use client";

import { useEffect, useRef } from "react";
import axios from "axios";

export default function Home() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setupVoiceInput();
  }, []);

  const setupVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const spokenText = event.results[0][0].transcript;
      sendToOpenAI(spokenText);
    };

    recognitionRef.current = recognition;
  };

  const sendToOpenAI = async (message: string) => {
    try {
      // Create a new thread
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

      // Send message
      await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/messages`,
        {
          role: "user",
          content: message,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );

      // Run the assistant
      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/runs`,
        {
          assistant_id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json",
          },
        }
      );

      const runId = runRes.data.id;

      // Wait until complete
      let runStatus = "in_progress";
      while (runStatus !== "completed") {
        await new Promise((res) => setTimeout(res, 2000));
        const statusRes = await axios.get(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              "OpenAI-Beta": "assistants=v2",
              "Content-Type": "application/json",
            },
          }
        );
        runStatus = statusRes.data.status;
      }

      // Get response
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

      const assistantReply =
        messagesRes.data.data.find((msg: any) => msg.role === "assistant")
          ?.content?.[0]?.text?.value || "لم أفهم ذلك.";

      speakOutLoud(assistantReply);
    } catch (err) {
      console.error("OpenAI API Error:", err);
      speakOutLoud("حدث خطأ أثناء الاتصال بالمساعد.");
    }
  };

  const speakOutLoud = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[أ-ي]/.test(text) ? "ar-SA" : "en-US";
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.cancel(); // Cancel any current speech
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    recognitionRef.current?.start();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <button
        onClick={startListening}
        className="bg-red-600 hover:bg-red
