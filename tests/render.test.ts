import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { renderFilledPdf, safeText, wrap } from "../src/lib/pdf/render";
import { gateTemplate as t } from "./fixtures";

describe("renderFilledPdf", () => {
  it("produces one A4-width page per template page with the scan's aspect ratio", async () => {
    const bytes = await renderFilledPdf(
      t,
      {
        datum: { value: "25.11.2026", confidence: "high", evidence: null },
        standort: { value: "Lager Süd, Tor 4 – Brandabschnitt B", confidence: "high", evidence: null },
        dichtung_ok: { value: "checked", confidence: "high", evidence: null },
      },
      { notes: "Türschließer nachstellen." },
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 1);
    expect(height / width).toBeCloseTo(1414 / 1000, 3);
    expect(pdf.getTitle()).toBe(t.name);
  });
});

describe("text helpers", () => {
  it("keeps umlauts and replaces characters the standard font cannot draw", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(safeText(font, "Prüfung „OK“ – ß")).toBe('Prüfung "OK" - ß');
    expect(safeText(font, "检查")).toBe("??");
  });
  it("wraps long text to the width", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const lines = wrap(font, "eins zwei drei vier fünf sechs sieben", 10, 60);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(60);
  });
});
