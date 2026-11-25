import { get, set, createStore } from "idb-keyval";

export type SttProvider = "webspeech" | "deepgram";

export interface Settings {
  anthropicKey: string;
  deepgramKey: string;
  stt: SttProvider;
  /** BCP-47 language used for speech recognition, e.g. "de-DE". */
  speechLanguage: string;
  /** Extra technical words to help speech recognition (one per line). */
  vocabulary: string;
}

export const DEFAULT_SETTINGS: Settings = {
  anthropicKey: "",
  deepgramKey: "",
  stt: "webspeech",
  speechLanguage: "de-DE",
  vocabulary: "",
};

const store = createStore("vff-settings", "kv");

export async function loadSettings(): Promise<Settings> {
  try {
    const s = await get<Partial<Settings>>("settings", store);
    return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const saveSettings = (s: Settings) => set("settings", s, store);
