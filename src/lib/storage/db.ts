import { createStore, del, get, keys, set, delMany } from "idb-keyval";
import type { FormTemplate, Session } from "../types";

const templates = createStore("vff-templates", "kv");
const sessions = createStore("vff-sessions", "kv");
const audio = createStore("vff-audio", "kv");

export async function listTemplates(): Promise<FormTemplate[]> {
  const ks = await keys(templates);
  const all = await Promise.all(ks.map((k) => get<FormTemplate>(k, templates)));
  return all.filter((t): t is FormTemplate => !!t).sort((a, b) => b.createdAt - a.createdAt);
}
export const getTemplate = (id: string) => get<FormTemplate>(id, templates);
export const saveTemplate = (t: FormTemplate) => set(t.id, t, templates);
export const deleteTemplate = (id: string) => del(id, templates);

export async function listSessions(): Promise<Session[]> {
  const ks = await keys(sessions);
  const all = await Promise.all(ks.map((k) => get<Session>(k, sessions)));
  return all.filter((s): s is Session => !!s).sort((a, b) => b.createdAt - a.createdAt);
}
export const getSession = (id: string) => get<Session>(id, sessions);
export const saveSession = (s: Session) => set(s.id, s, sessions);
export async function deleteSession(s: Session) {
  const chunkKeys = s.segments.flatMap((seg) =>
    Array.from({ length: seg.chunkCount }, (_, i) => chunkKey(seg.id, i)),
  );
  await delMany(chunkKeys, audio);
  await del(s.id, sessions);
}

const chunkKey = (segmentId: string, i: number) => `${segmentId}:${i}`;
export const saveChunk = (segmentId: string, i: number, blob: Blob) =>
  set(chunkKey(segmentId, i), blob, audio);

export async function loadSegmentAudio(segmentId: string, count: number, mime: string): Promise<Blob> {
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => get<Blob>(chunkKey(segmentId, i), audio)),
  );
  return new Blob(parts.filter((p): p is Blob => !!p), { type: mime });
}
