// Minimal typings for the Web Speech API (not in lib.dom for all browsers).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

function ctor(): (new () => SpeechRecognitionLike) | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
}

export const webSpeechSupported = () => typeof window !== "undefined" && !!ctor();

/**
 * Live, free speech recognition built into the browser (Chrome/Edge/Safari).
 * It keeps restarting itself because browsers stop after silence.
 */
export class LiveTranscriber {
  private rec?: SpeechRecognitionLike;
  private active = false;
  private finalText = "";

  constructor(
    private lang: string,
    private onUpdate: (finalText: string, interim: string) => void,
    private onError: (msg: string) => void = () => {},
  ) {}

  start(initialText = "") {
    const C = ctor();
    if (!C) throw new Error("Speech recognition is not supported in this browser.");
    this.finalText = initialText;
    this.active = true;
    this.spawn(C);
  }

  private spawn(C: new () => SpeechRecognitionLike) {
    const rec = new C();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finalText = joinText(this.finalText, r[0].transcript);
        else interim += r[0].transcript;
      }
      this.onUpdate(this.finalText, interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.active = false;
        this.onError("Microphone or speech service not allowed.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        this.onError(`Speech recognition: ${e.error}`);
      }
    };
    rec.onend = () => {
      if (this.active) setTimeout(() => this.active && this.spawn(C), 250);
    };
    this.rec = rec;
    rec.start();
  }

  stop(): string {
    this.active = false;
    this.rec?.stop();
    return this.finalText;
  }
}

export function joinText(a: string, b: string): string {
  const t = b.trim();
  if (!t) return a;
  return a ? `${a.trimEnd()} ${t}` : t;
}
