import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import FormPage from "../components/FormPage";
import { getSession, getTemplate, saveSession } from "../lib/storage/db";
import { fullTranscript, transcribeSegment } from "../lib/stt";
import { applyCorrection, extractFromTranscript } from "../lib/claude/extract";
import { applyUpdates, fieldsNeedingReview } from "../lib/template/schema";
import type { FieldValue, FormTemplate, Session, TemplateField } from "../lib/types";
import { useSettings } from "../useSettings";
import { downloadFile, safeFileName } from "../lib/download";
import { speak, useVoiceInput } from "../useVoiceInput";

export default function Review() {
  const { sessionId } = useParams();
  const [params, setParams] = useSearchParams();
  const { settings, loaded } = useSettings();
  const [s, setS] = useState<Session | null>(null);
  const [t, setT] = useState<FormTemplate | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pageIdx, setPageIdx] = useState(0);
  const [correction, setCorrection] = useState("");
  const [transcriptDraft, setTranscriptDraft] = useState<string | null>(null);
  const voice = useVoiceInput(settings);
  const started = useRef(false);

  useEffect(() => {
    (async () => {
      const ses = await getSession(sessionId!);
      if (!ses) return;
      setS(ses);
      setT((await getTemplate(ses.templateId)) ?? null);
    })();
  }, [sessionId]);

  const persist = async (next: Session) => {
    setS(next);
    await saveSession(next);
  };

  const transcript = s ? fullTranscript(s.segments) : "";
  const untranscribed = s?.segments.filter((x) => x.transcript == null && x.chunkCount > 0) ?? [];

  const process = useCallback(
    async (ses: Session, tpl: FormTemplate) => {
      setError("");
      try {
        let cur = ses;
        const todo = cur.segments.filter((x) => x.transcript == null && x.chunkCount > 0);
        for (let i = 0; i < todo.length; i++) {
          setBusy(`Transcribing recording ${i + 1}/${todo.length}…`);
          const text = await transcribeSegment(todo[i], settings);
          cur = {
            ...cur,
            segments: cur.segments.map((x) => (x.id === todo[i].id ? { ...x, transcript: text } : x)),
          };
          await persist(cur);
        }
        const text = fullTranscript(cur.segments);
        if (!text.trim()) throw new Error("No speech was recognised in the recording.");
        setBusy("Claude is filling the form…");
        const res = await extractFromTranscript({ apiKey: settings.anthropicKey, template: tpl, transcript: text });
        const values = applyUpdates(tpl, cur.values, res, { isCorrection: false });
        await persist({ ...cur, values, notes: res.notes || cur.notes });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy("");
      }
    },
    [settings],
  );

  // Coming straight from the recorder: transcribe and fill automatically.
  useEffect(() => {
    if (!s || !t || !loaded || started.current || params.get("process") !== "1") return;
    started.current = true;
    setParams({}, { replace: true });
    process(s, t);
  }, [s, t, loaded, params, setParams, process]);

  if (!s || !t) return <p className="muted">Loading…</p>;

  const needing = fieldsNeedingReview(t, s.values);
  const filled = t.fields.filter((f) => s.values[f.id]?.value != null).length;
  const de = (t.language || settings.speechLanguage).startsWith("de");

  const setValue = (f: TemplateField, value: string | null) =>
    persist({
      ...s,
      values: { ...s.values, [f.id]: { value, confidence: "high", evidence: null, manual: true } },
    });

  const runCorrection = async (text: string) => {
    if (!text.trim()) return;
    setError("");
    setBusy("Applying your correction…");
    try {
      const res = await applyCorrection({
        apiKey: settings.anthropicKey,
        template: t,
        transcript,
        values: s.values,
        correction: text,
      });
      const values = applyUpdates(t, s.values, res, { isCorrection: true });
      const notes = res.notes ? [s.notes, res.notes].filter(Boolean).join(" ") : s.notes;
      await persist({ ...s, values, notes, corrections: [...s.corrections, text] });
      setCorrection("");
      const changed = res.updates.map((u) => t.fields.find((f) => f.id === u.id)?.label).filter(Boolean);
      speak(
        changed.length
          ? `${de ? "Geändert" : "Updated"}: ${changed.join(", ")}`
          : de
            ? "Nichts geändert."
            : "Nothing changed.",
        settings.speechLanguage,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const readGaps = () => {
    const missing = needing.filter((f) => s.values[f.id]?.value == null).map((f) => f.label);
    const unsure = needing
      .filter((f) => s.values[f.id]?.value != null)
      .map((f) => `${f.label}: ${s.values[f.id].value}`);
    const parts: string[] = [];
    if (missing.length) parts.push(`${de ? "Es fehlt" : "Missing"}: ${missing.join(", ")}.`);
    if (unsure.length) parts.push(`${de ? "Bitte prüfen" : "Please check"}: ${unsure.join(", ")}.`);
    speak(parts.join(" ") || (de ? "Alles ausgefüllt." : "Everything is filled in."), settings.speechLanguage);
  };

  const makePdf = async () => {
    const { renderFilledPdf } = await import("../lib/pdf/render");
    const bytes = await renderFilledPdf(t, s.values, { notes: s.notes });
    const name = safeFileName(`${s.title || t.name}_${new Date(s.createdAt).toISOString().slice(0, 10)}.pdf`);
    return new File([bytes as BlobPart], name, { type: "application/pdf" });
  };

  const download = async () => {
    const file = await makePdf();
    downloadFile(file, file.name);
  };

  const share = async () => {
    const file = await makePdf();
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch {
      /* user cancelled */
    }
  };
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "a.pdf", { type: "application/pdf" })] });

  return (
    <section className="stack">
      <div className="row space">
        <h2>{t.name}</h2>
        <span className="muted small">
          {filled}/{t.fields.length} filled
        </span>
      </div>
      <input
        placeholder="Report title (e.g. location, gate number)"
        value={s.title}
        onChange={(e) => persist({ ...s, title: e.target.value })}
      />

      {busy && <p className="busy">{busy}</p>}
      {error && (
        <div className="error">
          {error}{" "}
          <button disabled={!!busy} onClick={() => process(s, t)}>
            Try again
          </button>
        </div>
      )}
      {!busy && untranscribed.length > 0 && !error && (
        <button className="primary" onClick={() => process(s, t)}>
          Transcribe and fill
        </button>
      )}

      {needing.length > 0 && !busy && (
        <div className="panel attention">
          <div className="row space">
            <b>{needing.length} field(s) need your attention</b>
            <button onClick={readGaps}>🔊 Read aloud</button>
          </div>
          <ul>
            {needing.map((f) => (
              <li key={f.id}>
                {f.label}
                {s.values[f.id]?.value != null ? ` — "${s.values[f.id].value}" (unsure)` : " — missing"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel stack">
        <b>Add or correct by voice</b>
        <p className="muted small">e.g. "The date is wrong, it was yesterday" or "Smoke detector checked, all OK".</p>
        <div className="row">
          <button
            className={`mic ${voice.listening ? "on" : ""}`}
            disabled={!!busy}
            onClick={async () => {
              if (voice.listening) {
                const text = await voice.stop();
                setCorrection(text);
                if (text.trim()) runCorrection(text);
              } else {
                voice.start();
              }
            }}
          >
            {voice.listening ? "⏹ Stop" : "🎙️ Speak"}
          </button>
          <input
            className="grow"
            value={voice.listening ? voice.interim : correction}
            placeholder="…or type it"
            onChange={(e) => setCorrection(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCorrection(correction)}
          />
          <button disabled={!!busy || !correction.trim()} onClick={() => runCorrection(correction)}>
            Apply
          </button>
        </div>
        {voice.error && <p className="error">{voice.error}</p>}
      </div>

      {t.pages.length > 1 && (
        <div className="tabs">
          {t.pages.map((_, i) => (
            <button key={i} className={i === pageIdx ? "active" : ""} onClick={() => setPageIdx(i)}>
              Page {i + 1}
            </button>
          ))}
        </div>
      )}
      <FormPage
        page={t.pages[pageIdx]}
        fields={t.fields.filter((f) => f.page === pageIdx)}
        values={s.values}
        onSelect={(id) => document.getElementById(`f-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />

      <div className="row">
        <button className="primary" onClick={download}>
          ⬇️ Download PDF
        </button>
        {canShare && <button onClick={share}>📤 Share</button>}
        <Link className="button" to={`/record/${t.id}?session=${s.id}`}>
          🎙️ Record more
        </Link>
      </div>

      <details open>
        <summary>All fields</summary>
        <div className="stack">
          {t.fields.map((f) => (
            <FieldEditor key={f.id} f={f} v={s.values[f.id]} onChange={(v) => setValue(f, v)} />
          ))}
          <label>
            Remarks (printed at the bottom of the last page)
            <textarea rows={3} value={s.notes} onChange={(e) => persist({ ...s, notes: e.target.value })} />
          </label>
        </div>
      </details>

      <details>
        <summary>Transcript</summary>
        <textarea
          rows={10}
          value={transcriptDraft ?? transcript}
          onChange={(e) => setTranscriptDraft(e.target.value)}
        />
        <div className="row">
          <button
            disabled={!!busy || transcriptDraft == null}
            onClick={async () => {
              const seg = { id: "edited", mime: "", chunkCount: 0, durationMs: 0, transcript: transcriptDraft ?? "" };
              const next = { ...s, segments: [...s.segments.filter((x) => x.chunkCount > 0).map((x) => ({ ...x, transcript: "" })), seg] };
              await persist(next);
              setTranscriptDraft(null);
              process(next, t);
            }}
          >
            Save transcript and fill again
          </button>
        </div>
        {s.corrections.length > 0 && (
          <>
            <p className="muted small">Corrections:</p>
            <ul className="small">
              {s.corrections.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}

function FieldEditor({ f, v, onChange }: { f: TemplateField; v?: FieldValue; onChange: (v: string | null) => void }) {
  const cls = `field ${v?.value == null ? (f.required && f.type !== "signature" ? "missing" : "") : `conf-${v.confidence}`}`;
  return (
    <div id={`f-${f.id}`} className={cls}>
      <div className="field-label">
        {f.label}
        {v?.value != null && !v.manual && v.confidence !== "high" && <span className="badge">{v.confidence}</span>}
      </div>
      {f.type === "checkbox" ? (
        <select value={v?.value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          <option value="checked">✔ checked</option>
          <option value="unchecked">✘ not checked</option>
        </select>
      ) : f.type === "choice" && f.options?.length ? (
        <select value={v?.value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {f.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : f.type === "signature" ? (
        <span className="muted small">Sign by hand on the printout.</span>
      ) : (
        <input value={v?.value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
      )}
      {v?.evidence && <div className="muted small evidence">“{v.evidence}”</div>}
    </div>
  );
}
