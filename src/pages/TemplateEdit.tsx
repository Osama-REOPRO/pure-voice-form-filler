import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FormPage from "../components/FormPage";
import { getTemplate, saveTemplate } from "../lib/storage/db";
import { slugId } from "../lib/template/schema";
import type { FieldType, FormTemplate, TemplateField } from "../lib/types";

const TYPES: FieldType[] = ["text", "number", "date", "checkbox", "choice", "signature"];

export default function TemplateEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [t, setT] = useState<FormTemplate | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getTemplate(id!).then((x) => setT(x ?? null));
  }, [id]);

  if (!t) return <p className="muted">Loading…</p>;

  const change = (patch: Partial<FormTemplate>) => {
    setT({ ...t, ...patch });
    setDirty(true);
  };
  const updateField = (fid: string, patch: Partial<TemplateField>) =>
    change({ fields: t.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });

  const addField = () => {
    const taken = new Set(t.fields.map((f) => f.id));
    const f: TemplateField = {
      id: slugId("field", taken),
      label: "New field",
      description: "",
      type: "text",
      required: false,
      page: pageIdx,
      box: { x: 0.35, y: 0.45, w: 0.3, h: 0.03 },
    };
    change({ fields: [...t.fields, f] });
    setSel(f.id);
  };

  const save = async () => {
    await saveTemplate(t);
    setDirty(false);
  };

  const selected = t.fields.find((f) => f.id === sel);
  const pageFields = t.fields.filter((f) => f.page === pageIdx);

  return (
    <section className="stack">
      <div className="row space">
        <h2>Edit form</h2>
        <div className="row">
          <button className="primary" disabled={!dirty} onClick={save}>
            {dirty ? "Save" : "Saved ✓"}
          </button>
          <button
            onClick={async () => {
              await save();
              nav(`/record/${t.id}`);
            }}
          >
            🎙️ Start
          </button>
        </div>
      </div>

      <div className="grid2">
        <label>
          Name
          <input value={t.name} onChange={(e) => change({ name: e.target.value })} />
        </label>
        <label>
          Form language
          <input value={t.language} onChange={(e) => change({ language: e.target.value })} placeholder="de" />
        </label>
      </div>

      <p className="muted small">
        Tap a box to select it. Drag it to move it; drag the corner to resize it. Boxes mark where the <b>answer</b> is
        written.
      </p>

      {t.pages.length > 1 && (
        <div className="tabs">
          {t.pages.map((_, i) => (
            <button key={i} className={i === pageIdx ? "active" : ""} onClick={() => setPageIdx(i)}>
              Page {i + 1}
            </button>
          ))}
        </div>
      )}

      <FormPage
        page={t.pages[pageIdx]}
        fields={pageFields}
        selectedId={sel}
        onSelect={setSel}
        onBoxChange={(fid, box) => updateField(fid, { box })}
      />

      <div className="row">
        <button onClick={addField}>+ Add field on this page</button>
      </div>

      {selected && (
        <div className="panel stack">
          <div className="row space">
            <b>Field</b>
            <button
              className="danger"
              onClick={() => {
                change({ fields: t.fields.filter((f) => f.id !== selected.id) });
                setSel(null);
              }}
            >
              Delete field
            </button>
          </div>
          <label>
            Label
            <input value={selected.label} onChange={(e) => updateField(selected.id, { label: e.target.value })} />
          </label>
          <label>
            Meaning (helps the AI understand what you say)
            <textarea
              rows={2}
              value={selected.description}
              onChange={(e) => updateField(selected.id, { description: e.target.value })}
            />
          </label>
          <div className="grid2">
            <label>
              Type
              <select
                value={selected.type}
                onChange={(e) => updateField(selected.id, { type: e.target.value as FieldType })}
              >
                {TYPES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={selected.required}
                onChange={(e) => updateField(selected.id, { required: e.target.checked })}
              />
              Required
            </label>
          </div>
          {selected.type === "choice" && (
            <label>
              Options (separated by |)
              <input
                value={(selected.options ?? []).join(" | ")}
                onChange={(e) =>
                  updateField(selected.id, {
                    options: e.target.value.split("|").map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </label>
          )}
        </div>
      )}

      <details>
        <summary>All fields ({t.fields.length})</summary>
        <ul className="fieldlist">
          {t.fields.map((f) => (
            <li key={f.id}>
              <button
                className={`link ${f.id === sel ? "bold" : ""}`}
                onClick={() => {
                  setPageIdx(f.page);
                  setSel(f.id);
                }}
              >
                p{f.page + 1} · {f.label}
              </button>{" "}
              <span className="muted small">{f.type}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
