/**
 * Deepgram pre-recorded transcription, called directly from the browser with the
 * user's own key (stored only on their device).
 */
export async function transcribeDeepgram(
  audio: Blob,
  opts: { apiKey: string; language: string; keyterms: string[] },
): Promise<string> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    language: deepgramLanguage(opts.language),
  });
  for (const k of opts.keyterms.slice(0, 50)) params.append("keyterm", k);

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${opts.apiKey}`, "Content-Type": audio.type || "audio/webm" },
    body: audio,
  });
  if (!res.ok) throw new Error(`Deepgram error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}

/** "de-DE" → "de"; "multi" passes through for automatic language switching. */
export function deepgramLanguage(lang: string): string {
  if (lang === "multi") return "multi";
  return lang.split("-")[0].toLowerCase() || "multi";
}
