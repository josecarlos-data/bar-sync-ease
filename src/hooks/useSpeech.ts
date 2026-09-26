import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { speakInstruction } from "@/lib/kitchen.functions";

export type KitchenVoice = "device" | "ai";

let audioUnlocked = false;
export function isAudioUnlocked() {
  return audioUnlocked;
}
export function unlockAudio() {
  audioUnlocked = true;
  // Warm up speechSynthesis (some browsers need a first call inside a user gesture)
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis?.speak(u);
  } catch {
    /* noop */
  }
}

function speakWithDevice(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) {
    toast.error("Este dispositivo no puede leer en voz alta");
    return;
  }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/^[•\-]\s*/gm, ""));
  u.lang = "es-ES";
  const voices = synth.getVoices();
  const es = voices.find((v) => v.lang.toLowerCase().startsWith("es"));
  if (es) u.voice = es;
  u.rate = 1;
  synth.speak(u);
}

let currentAudio: HTMLAudioElement | null = null;

async function speakWithAi(text: string) {
  const res = await speakInstruction({ data: { text } });
  if (!res.ok) {
    toast.error(res.error);
    return;
  }
  currentAudio?.pause();
  const audio = new Audio(`data:audio/wav;base64,${res.audio}`);
  currentAudio = audio;
  await audio.play();
}

export function useSpeech(voice: KitchenVoice) {
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    currentAudio?.pause();
    currentAudio = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (speaking) {
        stop();
        return;
      }
      setSpeaking(true);
      try {
        if (voice === "ai") await speakWithAi(text);
        else speakWithDevice(text);
      } catch {
        toast.error("No se pudo reproducir la voz");
      } finally {
        setSpeaking(false);
      }
    },
    [voice, speaking, stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { speak, stop, speaking };
}

/** Plays text automatically if allowed; used for auto-read of new instructions. */
export function useAutoSpeak(voice: KitchenVoice, auto: boolean) {
  const lastSpoken = useRef<string | null>(null);
  return useCallback(
    (id: string, text: string) => {
      if (!auto || !audioUnlocked || lastSpoken.current === id) return;
      lastSpoken.current = id;
      if (voice === "ai") {
        speakWithAi(text).catch(() => {});
      } else {
        speakWithDevice(text);
      }
    },
    [voice, auto],
  );
}
