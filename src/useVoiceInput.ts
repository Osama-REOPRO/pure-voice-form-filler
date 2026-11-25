import { useRef, useState } from "react";
import type { Settings } from "./lib/settings";
import { SegmentRecorder } from "./lib/recorder";
import { LiveTranscriber, transcribeSegment, webSpeechSupported } from "./lib/stt";

/**
 * Short voice input (e.g. a correction on the review screen).
 * Uses live browser recognition, or records and sends the clip to the cloud provider.
 */
export function useVoiceInput(settings: Settings) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const live = useRef<LiveTranscriber | null>(null);
  const rec = useRef<SegmentRecorder | null>(null);

  const useLive = settings.stt === "webspeech" && webSpeechSupported();

  async function start() {
    setError("");
    setInterim("");
    try {
      if (useLive) {
        live.current = new LiveTranscriber(
          settings.speechLanguage,
          (f, i) => setInterim(`${f} ${i}`.trim()),
          setError,
        );
        live.current.start();
      } else {
        rec.current = new SegmentRecorder();
        await rec.current.start();
      }
      setListening(true);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function stop(): Promise<string> {
    setListening(false);
    try {
      if (live.current) {
        const t = live.current.stop();
        live.current = null;
        return t;
      }
      if (rec.current) {
        const seg = await rec.current.stop();
        rec.current = null;
        setInterim("Transcribing…");
        const t = await transcribeSegment(seg, settings);
        setInterim(t);
        return t;
      }
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
    return "";
  }

  return { listening, interim, error, start, stop };
}

/** Reads text aloud with the device's built-in voice. */
export function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
