const speak = (text: string) => {
  const synth = window.speechSynthesis;

  const speakNow = () => {
    const voices = synth.getVoices();
    const isArabic = /[أ-ي]/.test(text);
    const selectedVoice = voices.find((v) =>
      isArabic ? v.lang === "ar-SA" : v.lang === "en-US"
    );

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedVoice?.lang || (isArabic ? "ar-SA" : "en-US");
    utterance.voice = selectedVoice || voices[0];
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;

    synth.cancel(); // Cancel any current speech
    synth.speak(utterance);
  };

  if (synth.getVoices().length === 0) {
    // Safari: wait for voices to load
    synth.onvoiceschanged = () => speakNow();
  } else {
    speakNow();
  }
};
