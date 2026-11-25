import type { Settings } from "../settings";
import { loadSegmentAudio } from "../storage/db";
import type { Segment } from "../types";
import { transcribeDeepgram } from "./deepgram";

export { LiveTranscriber, webSpeechSupported } from "./webspeech";

/** Transcribes a stored audio segment with the configured cloud provider. */
export async function transcribeSegment(seg: Segment, settings: Settings): Promise<string> {
  const audio = await loadSegmentAudio(seg.id, seg.chunkCount, seg.mime);
  if (audio.size === 0) return "";
  if (!settings.deepgramKey) throw new Error("Add a Deepgram API key in Settings.");
  return transcribeDeepgram(audio, {
    apiKey: settings.deepgramKey,
    language: settings.speechLanguage,
    keyterms: vocabularyList(settings.vocabulary),
  });
}

export function vocabularyList(v: string): string[] {
  return v
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function fullTranscript(segments: Segment[]): string {
  return segments
    .map((s) => s.transcript?.trim())
    .filter(Boolean)
    .join("\n\n");
}
