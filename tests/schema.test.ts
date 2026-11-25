import { describe, expect, it } from "vitest";
import { applyUpdates, coerceValue, extractionSchema, fieldsNeedingReview, slugId } from "../src/lib/template/schema";
import { gateTemplate as t } from "./fixtures";

const f = (id: string) => t.fields.find((x) => x.id === id)!;

describe("extractionSchema", () => {
  it("restricts ids to the template's fields and requires every property", () => {
    const s = extractionSchema(t) as any;
    const item = s.properties.updates.items;
    expect(item.properties.id.enum).toEqual(t.fields.map((x) => x.id));
    expect(item.required).toEqual(["id", "value", "confidence", "evidence"]);
    expect(item.additionalProperties).toBe(false);
  });
});

describe("coerceValue", () => {
  it("normalises checkbox answers", () => {
    expect(coerceValue(f("dichtung_ok"), "Ja")).toBe("checked");
    expect(coerceValue(f("dichtung_ok"), "unchecked")).toBe("unchecked");
    expect(coerceValue(f("dichtung_ok"), "maybe")).toBeNull();
  });
  it("matches choice options case-insensitively and rejects others", () => {
    expect(coerceValue(f("ergebnis"), "MÄNGEL")).toBe("Mängel");
    expect(coerceValue(f("ergebnis"), "super")).toBeNull();
  });
  it("never fills signatures", () => {
    expect(coerceValue(f("unterschrift"), "Max")).toBeNull();
  });
});

describe("applyUpdates", () => {
  it("keeps manual values on re-extraction but lets corrections override", () => {
    const current = { standort: { value: "Halle 3", confidence: "high" as const, evidence: null, manual: true } };
    const res = { updates: [{ id: "standort", value: "Halle 4", confidence: "high" as const, evidence: "Halle 4" }], notes: "" };
    expect(applyUpdates(t, current, res, { isCorrection: false }).standort.value).toBe("Halle 3");
    expect(applyUpdates(t, current, res, { isCorrection: true }).standort.value).toBe("Halle 4");
  });
  it("does not wipe a known value with null during extraction, but a correction can clear it", () => {
    const current = { datum: { value: "01.02.2026", confidence: "high" as const, evidence: null } };
    const res = { updates: [{ id: "datum", value: null, confidence: "low" as const, evidence: null }], notes: "" };
    expect(applyUpdates(t, current, res, { isCorrection: false }).datum.value).toBe("01.02.2026");
    expect(applyUpdates(t, current, res, { isCorrection: true }).datum.value).toBeNull();
  });
  it("ignores unknown ids", () => {
    const res = { updates: [{ id: "nope", value: "x", confidence: "high" as const, evidence: null }], notes: "" };
    expect(applyUpdates(t, {}, res, { isCorrection: false })).toEqual({});
  });
});

describe("fieldsNeedingReview", () => {
  it("lists required empty fields (not signatures) and low-confidence values", () => {
    const ids = fieldsNeedingReview(t, {
      datum: { value: "1.1.2026", confidence: "low", evidence: null },
      standort: { value: "Halle 3", confidence: "high", evidence: null },
    }).map((x) => x.id);
    expect(ids).toEqual(["ergebnis", "datum"]);
  });
});

describe("slugId", () => {
  it("makes unique ascii ids", () => {
    const taken = new Set<string>();
    expect(slugId("Türschließer prüfen", taken)).toBe("turschliesser_prufen");
    expect(slugId("Türschließer prüfen", taken)).toBe("turschliesser_prufen_2");
  });
});

import { safeFileName } from "../src/lib/download";
describe("safeFileName", () => {
  it("transliterates umlauts and removes spaces", () => {
    expect(safeFileName("Prüfbericht Feuerschutztor_2026-11-25.pdf")).toBe("Pruefbericht_Feuerschutztor_2026-11-25.pdf");
  });
});
