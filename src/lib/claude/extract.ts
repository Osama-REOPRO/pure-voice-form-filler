import type { FieldValue, FormTemplate } from "../types";
import { describeFields, extractionSchema, type ExtractionResult } from "../template/schema";
import { structuredCall } from "./client";

function systemPrompt(t: FormTemplate): string {
  return `You fill out a paper form from a spoken description. The speaker is a person doing the work the form is about (for example a technician inspecting equipment). They talk freely while they work: they describe what they do, what they see, and what they measure. The transcript comes from speech recognition, so expect missing punctuation, filler words, and technical terms that were heard wrongly. Work out what was meant from the context.

The form is called "${t.name}" and is written in language "${t.language}". Write every value in that language, short and in the style a person would write by hand on the form.

Value formats by field type:
- text: a short phrase or sentence.
- number: digits only, with the decimal separator used in the form's language, and a unit only if the field label lacks one.
- date: the usual written form for the form's language (e.g. 25.11.2026 for German).
- checkbox: "checked" or "unchecked". Use "checked" when the speaker confirms the item applies or was found OK, and "unchecked" when they say it does not apply or failed.
- choice: exactly one of the listed options, character for character.
- signature: never fill; always null.

Rules:
- Only fill a field when the transcript supports it. If something was not mentioned, give value null. Do not guess and do not invent defaults.
- confidence: "high" = stated clearly; "medium" = reasonably implied; "low" = unclear audio or a guess the user should check.
- evidence: a short quote from the transcript that supports the value, or null.
- If the speaker corrects themselves ("no wait, it was 3 not 4"), use the latest statement.
- notes: one or two sentences on anything important that was said but fits no field (defects, recommendations). Empty string if none.

Fields of this form:
${describeFields(t)}`;
}

export async function extractFromTranscript(opts: {
  apiKey: string;
  template: FormTemplate;
  transcript: string;
}): Promise<ExtractionResult> {
  const today = new Date().toLocaleDateString(opts.template.language || undefined);
  return structuredCall<ExtractionResult>({
    apiKey: opts.apiKey,
    system: systemPrompt(opts.template),
    schema: extractionSchema(opts.template),
    content: [
      {
        type: "text",
        text: `Today's date: ${today}\n\nTranscript of the recording:\n<transcript>\n${opts.transcript}\n</transcript>\n\nReturn an update for every field you can fill.`,
      },
    ],
  });
}

export async function applyCorrection(opts: {
  apiKey: string;
  template: FormTemplate;
  transcript: string;
  values: Record<string, FieldValue>;
  correction: string;
}): Promise<ExtractionResult> {
  const current = opts.template.fields
    .map((f) => `${f.id}: ${opts.values[f.id]?.value ?? "(empty)"}`)
    .join("\n");
  const today = new Date().toLocaleDateString(opts.template.language || undefined);
  return structuredCall<ExtractionResult>({
    apiKey: opts.apiKey,
    system: systemPrompt(opts.template),
    schema: extractionSchema(opts.template),
    effort: "low",
    content: [
      {
        type: "text",
        text: `Today's date: ${today}\n\nOriginal transcript:\n<transcript>\n${opts.transcript}\n</transcript>\n\nCurrent form values:\n<values>\n${current}\n</values>\n\nThe user now says this to add to or correct the form:\n<correction>\n${opts.correction}\n</correction>\n\nReturn updates ONLY for the fields this correction changes. To clear a field, return value null for it. Set notes to the empty string unless the correction adds a remark.`,
      },
    ],
  });
}
