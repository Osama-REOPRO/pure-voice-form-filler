import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getSession, getTemplate, saveSession } from "../lib/storage/db";
import { SegmentRecorder } from "../lib/recorder";
import { LiveTranscriber, webSpeechSupported } from "../lib/stt";
import { newId } from "../lib/id";
import type { FormTemplate, Segment, Session } from "../lib/types";
import { useSettings } from "../useSettings";

type State = "idle" | "recording" | "paused";

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock.request("screen").then((l) => (lock = l), () => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [active]);
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Record() {
  const { templateId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { settings, loaded } = useSettings();
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [state, setState] = useState<State>("idle");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const session = useRef<Session | null>(null);
  const recorder = useRef<SegmentRecorder | null>(null);
  const live = useRef<LiveTranscriber | null>(null);
  const liveSeg = useRef<Segment | null>(null);
  const liveStart = useRef(0);
  const saveTimer = useRef<number>(undefined);

  const mode = settings.stt === "webspeech" && webSpeechSupported() ? "live" : "audio";
  useWakeLock(state !== "idle");

  useEffect(() => {
    getTemplate(templateId!).then((t) => setTemplate(t ?? null));
    const sid = params.get("session");
    if (sid) getSession(sid).then((s) => s && (session.current = s));
  }, [templateId, params]);

  useEffect(() => {
    if (state !== "recording") return;
    const iv = setInterval(() => {
      setElapsed(recorder.current ? recorder.current.elapsedMs() : Date.now() - liveStart.current);
    }, 500);
    return () => clearInterval(iv);
  }, [state]);

  const ensureSession = async (): Promise<Session> => {
    if (!session.current) {
      session.current = {
        id: newId("ses_"),
        templateId: templateId!,
        title: "",
        createdAt: Date.now(),
        segments: [],
        values: {},
        corrections: [],
        notes: "",
      };
      await saveSession(session.current);
    }
    return session.current;
  };

  const persistLive = (finalText: string) => {
    const s = session.current;
    const seg = liveSeg.current;
    if (!s || !seg) return;
    seg.transcript = finalText;
    seg.durationMs = Date.now() - liveStart.current;
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveSession(s), 800);
  };

  const start = async () => {
    setError("");
    try {
      const s = await ensureSession();
      if (mode === "live") {
        const seg: Segment = { id: newId("seg_"), mime: "", chunkCount: 0, durationMs: 0, transcript: "" };
        s.segments.push(seg);
        liveSeg.current = seg;
        liveStart.current = Date.now();
        live.current = new LiveTranscriber(
          settings.speechLanguage === "multi" ? "de-DE" : settings.speechLanguage,
          (f, i) => {
            setText(f);
            setInterim(i);
            persistLive(f);
          },
          setError,
        );
        live.current.start();
      } else {
        recorder.current = new SegmentRecorder();
        await recorder.current.start();
      }
      setState("recording");
    } catch (e) {
      setError(`Could not start the microphone: ${(e as Error).message}`);
    }
  };

  // Pausing live recognition = stop + new segment on resume (browsers can't pause it).
  const pause = async () => {
    if (live.current) {
      persistLive(live.current.stop());
      live.current = null;
    }
    recorder.current?.pause();
    setState("paused");
  };

  const resume = async () => {
    if (mode === "live") return start();
    recorder.current?.resume();
    setState("recording");
  };

  const finish = async () => {
    const s = await ensureSession();
    if (live.current) {
      persistLive(live.current.stop());
      live.current = null;
    }
    if (recorder.current) {
      s.segments.push(await recorder.current.stop());
      recorder.current = null;
    }
    clearTimeout(saveTimer.current);
    s.segments = s.segments.filter((seg) => seg.chunkCount > 0 || seg.transcript);
    await saveSession(s);
    setState("idle");
    nav(`/review/${s.id}?process=1`, { replace: true });
  };

  if (!template) return <p className="muted">Loading…</p>;

  return (
    <section className="stack center">
      <h2>{template.name}</h2>
      <p className="muted small">
        Describe what you check and what you see, in your own words. You can mention the location, date, findings,
        measurements and defects in any order.
      </p>

      <div className={`recbutton ${state}`}>
        {state === "idle" && (
          <button onClick={start} disabled={!loaded} aria-label="Start recording">
            🎙️
            <span>Start</span>
          </button>
        )}
        {state === "recording" && (
          <button onClick={pause} aria-label="Pause">
            ⏸
            <span>{fmt(elapsed)}</span>
          </button>
        )}
        {state === "paused" && (
          <button onClick={resume} aria-label="Resume">
            ▶️
            <span>Paused</span>
          </button>
        )}
      </div>

      {state !== "idle" && (
        <button className="primary big" onClick={finish}>
          ✅ Done — fill the form
        </button>
      )}
      {error && <p className="error">{error}</p>}

      {mode === "live" ? (
        (text || interim) && (
          <div className="transcript">
            {text} <span className="muted">{interim}</span>
          </div>
        )
      ) : (
        state !== "idle" && (
          <p className="muted small">Recording is saved on the phone as you talk. It is transcribed when you press Done.</p>
        )
      )}
    </section>
  );
}
