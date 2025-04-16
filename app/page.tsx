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
            Authorization: `Bearer ${process.env.NEXT
