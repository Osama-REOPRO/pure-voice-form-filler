import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { FieldValue, FormTemplate } from "../types";

const PAGE_WIDTH_PT = 595.28; // A4 width; height follows the scan's aspect ratio
const INK = rgb(0.05, 0.15, 0.55);

export interface RenderOptions {
  /** Remarks printed in a box at the bottom of the last page (optional). */
  notes?: string;
}

/** Writes the values onto the scanned blank form and returns a PDF file. */
export async function renderFilledPdf(
  t: FormTemplate,
  values: Record<string, FieldValue>,
  opts: RenderOptions = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(t.name);
  pdf.setCreator("Voice Form Filler");
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (let pi = 0; pi < t.pages.length; pi++) {
    const p = t.pages[pi];
    const W = PAGE_WIDTH_PT;
    const H = (PAGE_WIDTH_PT * p.height) / p.width;
    const page = pdf.addPage([W, H]);
    const img = await embedImage(pdf, p.image);
    page.drawImage(img, { x: 0, y: 0, width: W, height: H });

    for (const f of t.fields.filter((f) => f.page === pi)) {
      const v = values[f.id]?.value;
      if (v == null || v === "") continue;
      const bx = f.box.x * W;
      const bw = f.box.w * W;
      const bh = f.box.h * H;
      const top = H - f.box.y * H; // pdf-lib's y axis starts at the bottom

      if (f.type === "checkbox") {
        if (v !== "checked") continue;
        const size = Math.max(6, Math.min(bh, bw) * 0.9);
        const tw = font.widthOfTextAtSize("X", size);
        page.drawText("X", { x: bx + (bw - tw) / 2, y: top - bh / 2 - size * 0.35, size, font, color: INK });
        continue;
      }
      drawFitted(page, font, safeText(font, v), bx, top, bw, bh);
    }
  }

  if (opts.notes?.trim()) {
    const last = pdf.getPages()[pdf.getPageCount() - 1];
    const { width } = last.getSize();
    const text = safeText(font, `Notes: ${opts.notes.trim()}`);
    const lines = wrap(font, text, 8, width - 60);
    const h = lines.length * 10 + 10;
    last.drawRectangle({ x: 25, y: 20, width: width - 50, height: h, color: rgb(1, 1, 1), opacity: 0.85 });
    lines.forEach((l, i) => last.drawText(l, { x: 30, y: 20 + h - 12 - i * 10, size: 8, font, color: INK }));
  }

  return pdf.save();
}

type Page = ReturnType<PDFDocument["addPage"]>;

/** Shrinks the font until the text fits the box; wraps onto several lines if the box is tall. */
function drawFitted(page: Page, font: PDFFont, text: string, x: number, top: number, w: number, h: number) {
  const pad = Math.min(2, w * 0.05);
  const maxW = Math.max(4, w - pad * 2);
  for (let size = Math.min(11, h * 0.75); size >= 5; size -= 0.5) {
    const lineH = size * 1.15;
    const maxLines = Math.max(1, Math.floor(h / lineH));
    const lines = maxLines === 1 ? [text] : wrap(font, text, size, maxW);
    const fits = lines.length <= maxLines && lines.every((l) => font.widthOfTextAtSize(l, size) <= maxW);
    if (fits || size <= 5) {
      const used = lines.slice(0, maxLines);
      const blockH = used.length * lineH;
      const startY = top - (h - blockH) / 2 - size * 0.85;
      used.forEach((l, i) => page.drawText(l, { x: x + pad, y: startY - i * lineH, size, font, color: INK }));
      return;
    }
  }
}

export function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const cand = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(cand, size) <= maxW || !line) line = cand;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/** Drops characters the standard PDF font cannot encode (German umlauts and ß are fine). */
export function safeText(font: PDFFont, s: string): string {
  const replaced = s.replace(/[„“”]/g, '"').replace(/[‚‘’]/g, "'").replace(/[–—]/g, "-");
  let out = "";
  for (const ch of replaced) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

async function embedImage(pdf: PDFDocument, dataUrl: string): Promise<PDFImage> {
  const [head, b64] = dataUrl.split(",", 2);
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return head.includes("image/png") ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}
