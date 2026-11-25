import type { Confidence, FieldValue, FormTemplate, TemplateField } from "../types";

export interface ExtractionUpdate {
  id: string;
  value: string | null;
  confidence: Confidence;
  evidence: string | null;
}

export interface ExtractionResult {
  updates: ExtractionUpdate[];
  notes: string;
}

/**
 * JSON schema for Claude's structured output. Uses a list of {id, value} updates rather than
 * one property per field, so forms with hundreds of fields (tax forms) stay within schema limits.
 */
export function extractionSchema(t: FormTemplate): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["updates", "notes"],
    properties: {
      updates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "value", "confidence", "evidence"],
          properties: {
            id: { type: "string", enum: t.fields.map((f) => f.id) },
            value: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            evidence: { type: ["string", "null"] },
          },
        },
      },
      notes: { type: "string" },
    },
  };
}

export function describeFields(t: FormTemplate): string {
  return t.fields
    .map((f) => {
      const parts = [`- id: ${f.id}`, `  label: ${f.label}`, `  type: ${f.type}`];
      if (f.options?.length) parts.push(`  options: ${f.options.join(" | ")}`);
      if (f.description) parts.push(`  meaning: ${f.description}`);
      if (f.required) parts.push(`  required: yes`);
      return parts.join("\n");
    })
    .join("\n");
}

const CHECKED = new Set(["checked", "true", "yes", "ja", "x", "1", "ok", "i.o.", "io"]);
const UNCHECKED = new Set(["unchecked", "false", "no", "nein", "0", "", "n.i.o.", "nio"]);

/** Normalises a model value to the field's type; returns null if it can't be used. */
export function coerceValue(f: TemplateField, raw: string | null): string | null {
  if (raw == null) return null;
  const v = raw.trim();
  switch (f.type) {
    case "signature":
      return null; // never filled automatically
    case "checkbox": {
      const k = v.toLowerCase();
      if (CHECKED.has(k)) return "checked";
      if (UNCHECKED.has(k)) return "unchecked";
      return null;
    }
    case "choice": {
      if (!f.options?.length) return v || null;
      const hit = f.options.find((o) => o.toLowerCase() === v.toLowerCase());
      return hit ?? null;
    }
    default:
      return v || null;
  }
}

/** Applies model updates to the current values. Manually-entered values are kept unless overridden by a correction. */
export function applyUpdates(
  t: FormTemplate,
  current: Record<string, FieldValue>,
  result: ExtractionResult,
  opts: { isCorrection: boolean },
): Record<string, FieldValue> {
  const next: Record<string, FieldValue> = { ...current };
  const byId = new Map(t.fields.map((f) => [f.id, f]));
  for (const u of result.updates) {
    const f = byId.get(u.id);
    if (!f) continue;
    const prev = next[u.id];
    if (prev?.manual && !opts.isCorrection) continue;
    const value = coerceValue(f, u.value);
    if (value == null && prev?.value != null && opts.isCorrection) {
      // A correction that explicitly clears a value.
      if (u.value === null || u.value.trim() === "") {
        next[u.id] = { value: null, confidence: u.confidence, evidence: u.evidence };
      }
      continue;
    }
    if (value == null && prev?.value != null) continue;
    next[u.id] = { value, confidence: u.confidence, evidence: u.evidence };
  }
  return next;
}

/** Fields that still need attention: required-but-empty first, then low-confidence values. */
export function fieldsNeedingReview(t: FormTemplate, values: Record<string, FieldValue>): TemplateField[] {
  const missing = t.fields.filter(
    (f) => f.type !== "signature" && f.required && values[f.id]?.value == null,
  );
  const unsure = t.fields.filter(
    (f) => values[f.id]?.value != null && values[f.id]?.confidence === "low" && !values[f.id]?.manual,
  );
  return [...missing, ...unsure];
}

/** Turns a label into a stable snake_case id, unique within `taken`. */
export function slugId(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/ß/g, "ss")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}_${i}`;
  taken.add(id);
  return id;
}
