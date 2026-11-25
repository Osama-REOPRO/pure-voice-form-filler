import { useRef } from "react";
import type { Box, FieldValue, TemplateField, TemplatePage } from "../lib/types";

interface Props {
  page: TemplatePage;
  fields: TemplateField[];
  values?: Record<string, FieldValue>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** When set, boxes can be dragged and resized. */
  onBoxChange?: (id: string, box: Box) => void;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** A form page with field boxes drawn on top (editor) or filled values (preview). */
export default function FormPage({ page, fields, values, selectedId, onSelect, onBoxChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.PointerEvent, f: TemplateField, mode: "move" | "resize") => {
    if (!onBoxChange || !ref.current) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(f.id);
    const rect = ref.current.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const b0 = { ...f.box };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / rect.width;
      const dy = (ev.clientY - sy) / rect.height;
      const box =
        mode === "move"
          ? { ...b0, x: clamp(b0.x + dx, 0, 1 - b0.w), y: clamp(b0.y + dy, 0, 1 - b0.h) }
          : { ...b0, w: clamp(b0.w + dx, 0.01, 1 - b0.x), h: clamp(b0.h + dy, 0.005, 1 - b0.y) };
      onBoxChange(f.id, box);
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  return (
    <div className="formpage" ref={ref} style={{ aspectRatio: `${page.width} / ${page.height}` }}>
      <img src={page.image} alt="" draggable={false} />
      {fields.map((f) => {
        const v = values?.[f.id];
        const style = {
          left: `${f.box.x * 100}%`,
          top: `${f.box.y * 100}%`,
          width: `${f.box.w * 100}%`,
          height: `${f.box.h * 100}%`,
        };
        if (values) {
          if (v?.value == null) {
            return f.required && f.type !== "signature" ? (
              <div key={f.id} className="fp-missing" style={style} onClick={() => onSelect?.(f.id)} />
            ) : null;
          }
          return (
            <div
              key={f.id}
              className={`fp-value conf-${v.confidence}`}
              style={style}
              onClick={() => onSelect?.(f.id)}
              title={f.label}
            >
              {f.type === "checkbox" ? (v.value === "checked" ? "X" : "") : v.value}
            </div>
          );
        }
        return (
          <div
            key={f.id}
            className={`fp-box ${selectedId === f.id ? "selected" : ""}`}
            style={style}
            onPointerDown={(e) => (onBoxChange ? startDrag(e, f, "move") : onSelect?.(f.id))}
            title={f.label}
          >
            <span className="fp-label">{f.label}</span>
            {onBoxChange && selectedId === f.id && (
              <span className="fp-handle" onPointerDown={(e) => startDrag(e, f, "resize")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
