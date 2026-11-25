import { useEffect, useState } from "react";
import { useSettings } from "../useSettings";
import { webSpeechSupported } from "../lib/stt";
import type { Settings } from "../lib/settings";

const LANGS = [
  ["de-DE", "Deutsch"],
  ["en-US", "English"],
  ["ar-SA", "العربية"],
  ["tr-TR", "Türkçe"],
  ["multi", "Mixed / auto (Deepgram only)"],
];

export default function SettingsPage() {
  const { settings, update, loaded } = useSettings();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(settings), [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Settings>) => {
    setDraft({ ...draft, ...patch });
    setSaved(false);
  };

  return (
    <section className="stack">
      <h2>Settings</h2>
      <p className="muted small">
        Keys are stored only on this device and sent directly to the AI services. They are never uploaded anywhere
        else. Don't use this app on a shared device with your keys saved.
      </p>

      <label>
        Anthropic API key (Claude: fills the form)
        <input
          type="password"
          autoComplete="off"
          value={draft.anthropicKey}
          placeholder="sk-ant-…"
          onChange={(e) => set({ anthropicKey: e.target.value.trim() })}
        />
        <span className="muted small">
          Get one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
          A form usually costs a few cents.
        </span>
      </label>

      <fieldset>
        <legend>Speech recognition</legend>
        <label className="radio">
          <input type="radio" checked={draft.stt === "webspeech"} onChange={() => set({ stt: "webspeech" })} />
          <span>
            <b>Built-in browser recognition</b> — free, no key, live text while you talk. Needs internet while recording.
            {!webSpeechSupported() && <span className="warn"> Not supported in this browser.</span>}
          </span>
        </label>
        <label className="radio">
          <input type="radio" checked={draft.stt === "deepgram"} onChange={() => set({ stt: "deepgram" })} />
          <span>
            <b>Deepgram</b> — more accurate with technical terms. Records offline, transcribes when you're back online.
          </span>
        </label>
        {draft.stt === "deepgram" && (
          <label>
            Deepgram API key
            <input
              type="password"
              autoComplete="off"
              value={draft.deepgramKey}
              onChange={(e) => set({ deepgramKey: e.target.value.trim() })}
            />
          </label>
        )}
      </fieldset>

      <label>
        Language you speak
        <select value={draft.speechLanguage} onChange={(e) => set({ speechLanguage: e.target.value })}>
          {LANGS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label>
        Technical words (one per line). Helps speech recognition with your vocabulary.
        <textarea
          rows={4}
          value={draft.vocabulary}
          placeholder={"Feststellanlage\nRauchschalter\nTürschließer"}
          onChange={(e) => set({ vocabulary: e.target.value })}
        />
      </label>

      <div className="row">
        <button
          className="primary"
          onClick={async () => {
            await update(draft);
            setSaved(true);
          }}
        >
          Save
        </button>
        {saved && <span className="ok">Saved ✓</span>}
      </div>
    </section>
  );
}
