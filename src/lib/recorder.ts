import { saveChunk } from "./storage/db";
import { newId } from "./id";
import type { Segment } from "./types";

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const m of candidates) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return "";
}

/**
 * Records one audio segment. Every few seconds the newest chunk is written to IndexedDB,
 * so a crash, a reload or a dead battery loses at most a few seconds of speech.
 */
export class SegmentRecorder {
  private rec?: MediaRecorder;
  private stream?: MediaStream;
  private chunkCount = 0;
  private pending: Promise<unknown>[] = [];
  private startedAt = 0;
  private pausedMs = 0;
  private pausedAt = 0;
  readonly segmentId = newId("seg_");
  mime = "";

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.mime = pickMime();
    this.rec = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.mime = this.rec.mimeType || this.mime || "audio/webm";
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.pending.push(saveChunk(this.segmentId, this.chunkCount++, e.data));
    };
    this.rec.start(3000);
    this.startedAt = Date.now();
  }

  pause() {
    if (this.rec?.state === "recording") {
      this.rec.pause();
      this.pausedAt = Date.now();
    }
  }

  resume() {
    if (this.rec?.state === "paused") {
      this.rec.resume();
      this.pausedMs += Date.now() - this.pausedAt;
    }
  }

  get state() {
    return this.rec?.state ?? "inactive";
  }

  elapsedMs() {
    if (!this.startedAt) return 0;
    const now = this.rec?.state === "paused" ? this.pausedAt : Date.now();
    return now - this.startedAt - this.pausedMs;
  }

  async stop(): Promise<Segment> {
    const rec = this.rec;
    const durationMs = this.elapsedMs();
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        rec.stop();
      });
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    await Promise.all(this.pending);
    return { id: this.segmentId, mime: this.mime, chunkCount: this.chunkCount, durationMs };
  }
}
