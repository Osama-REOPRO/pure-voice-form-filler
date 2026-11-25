import type { FieldType, FormTemplate, TemplateField, TemplatePage } from "../types";
import { slugId } from "../template/schema";
import { dataUrlToImageBlock, structuredCall } from "./client";

interface DetectedField {
  label: string;
  description: string;
  type: FieldType;
  options: string[];
  required: boolean;
  page: number;
  box: { x: number; y: number; w: number; h: number };
}

interface DetectResult {
  name: string;
  language: string;
  fields: DetectedField[];
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "language", "fields"],
  properties: {
    name: { type: "string" },
    language: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "description", "type", "options", "required", "page", "box"],
        properties: {
          label: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: ["text", "number", "date", "checkbox", "choice", "signature"] },
          options: { type: "array", items: { type: "string" } },
          required: { type: "boolean" },
          page: { type: "integer" },
          box: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "w", "h"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = `You turn images of a blank paper form into a list of fillable fields, so an app can later write answers onto the scan.

For every place on the form where a person writes, ticks or signs something, return one field:
- label: the printed label, as on the form (keep the form's language).
- description: one sentence that explains what the answer means, so another assistant can pick the answer out of a spoken report. Include synonyms a technician might say.
- type: text | number | date | checkbox | choice | signature.
  Use "checkbox" for each single tick box. For a row with several tick boxes that mean different answers (e.g. "OK / not OK / n/a"), return one checkbox per box and put the row label plus the box's own meaning in the label, e.g. "Seal – OK".
  Use "choice" only when the answer is written as one of a few words in a single space.
- options: the allowed answers for "choice"; otherwise an empty list.
- required: true if the form clearly expects an answer (e.g. date, location, result), else false.
- page: 1-based page number in the order the images were given.
- box: where the ANSWER goes (the empty line, cell or tick box), not the label. Coordinates are fractions of the page image: x and y for the top-left corner, w and h for width and height, all between 0 and 1. Be as precise as you can; the user fixes small offsets afterwards.

Also return a short name for the form and its language code (e.g. "de").
Skip purely decorative areas, headers and printed instructions. Return the fields in reading order.`;

export async function detectFields(apiKey: string, pages: TemplatePage[]): Promise<Pick<FormTemplate, "name" | "language" | "fields">> {
  const content = pages.flatMap((p, i) => [
    { type: "text" as const, text: `Page ${i + 1}:` },
    dataUrlToImageBlock(p.image),
  ]);
  content.push({ type: "text", text: "List all fields of this form." });
  const res = await structuredCall<DetectResult>({ apiKey, system: SYSTEM, content, schema, effort: "high" });
  const taken = new Set<string>();
  const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  const fields: TemplateField[] = res.fields.map((f) => ({
    id: slugId(f.label, taken),
    label: f.label,
    description: f.description,
    type: f.type,
    options: f.options.length ? f.options : undefined,
    required: f.required,
    page: Math.min(pages.length, Math.max(1, Math.round(f.page))) - 1,
    box: { x: clamp(f.box.x), y: clamp(f.box.y), w: clamp(f.box.w) || 0.1, h: clamp(f.box.h) || 0.02 },
  }));
  return { name: res.name, language: res.language || "de", fields };
}
