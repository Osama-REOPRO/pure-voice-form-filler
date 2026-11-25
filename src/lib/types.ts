export type FieldType = "text" | "number" | "date" | "checkbox" | "choice" | "signature";

/** Normalized rectangle (0–1) relative to the page image. Marks where the answer goes. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TemplateField {
  id: string;
  label: string;
  /** Hint for the AI: what this field means and how to recognise it in speech. */
  description: string;
  type: FieldType;
  options?: string[];
  required: boolean;
  /** 0-based page index */
  page: number;
  box: Box;
}

export interface TemplatePage {
  /** data: URL (image/jpeg or image/png) of the blank form page */
  image: string;
  width: number;
  height: number;
}

export interface FormTemplate {
  id: string;
  name: string;
  /** BCP-47 language of the form, e.g. "de" */
  language: string;
  createdAt: number;
  pages: TemplatePage[];
  fields: TemplateField[];
}

export type Confidence = "high" | "medium" | "low";

export interface FieldValue {
  /** Always a string; checkboxes use "checked"/"unchecked". null = unknown. */
  value: string | null;
  confidence: Confidence;
  evidence: string | null;
  /** Set when the user typed or confirmed the value on the review screen. */
  manual?: boolean;
}

export interface Segment {
  id: string;
  mime: string;
  chunkCount: number;
  durationMs: number;
  /** Transcript for this segment; filled live (Web Speech) or after upload (cloud STT). */
  transcript?: string;
}

export interface Session {
  id: string;
  templateId: string;
  title: string;
  createdAt: number;
  segments: Segment[];
  values: Record<string, FieldValue>;
  /** Spoken or typed corrections made on the review screen, in order. */
  corrections: string[];
  notes: string;
}
