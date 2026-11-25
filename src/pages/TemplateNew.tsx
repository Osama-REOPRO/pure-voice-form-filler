import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fileToPages } from "../lib/pdf/pages";
import { detectFields } from "../lib/claude/detect";
import { saveTemplate } from "../lib/storage/db";
import { newId } from "../lib/id";
import type { TemplatePage } from "../lib/types";
import { useSettings } from "../useSettings";

export default function TemplateNew() {
  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { settings } = useSettings();
  const nav = useNavigate();

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setBusy("Reading file…");
    try {
      const all: TemplatePage[] = [];
      for (const f of Array.from(files)) all.push(...(await fileToPages(f)));
      setPages((p) => [...p, ...all]);
    } catch (e) {
      setError(`Could not read file: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  const create = async (detect: boolean) => {
    setError("");
    try {
      let name = "New form";
      let language = settings.speechLanguage.split("-")[0] || "de";
      let fields: Awaited<ReturnType<typeof detectFields>>["fields"] = [];
      if (detect) {
        setBusy("Claude is reading the form… (this can take a minute)");
        ({ name, language, fields } = await detectFields(settings.anthropicKey, pages));
      }
      const t = { id: newId("tpl_"), name, language, createdAt: Date.now(), pages, fields };
      await saveTemplate(t);
      nav(`/templates/${t.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="stack">
      <h2>New form</h2>
      <p className="muted">
        Take a photo of the <b>blank</b> form (flat, straight from above, good light) or upload it as a PDF. For several
        pages, add them in order.
      </p>
      <div className="row">
        <label className="button primary">
          📷 Take photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
        </label>
        <label className="button">
          📄 Upload PDF / image
          <input type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </label>
      </div>

      {pages.length > 0 && (
        <>
          <div className="thumbs">
            {pages.map((p, i) => (
              <figure key={i}>
                <img src={p.image} alt={`Page ${i + 1}`} />
                <figcaption>
                  Page {i + 1}{" "}
                  <button className="link" onClick={() => setPages(pages.filter((_, j) => j !== i))}>
                    remove
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="row">
            <button className="primary" disabled={!!busy} onClick={() => create(true)}>
              ✨ Detect fields with AI
            </button>
            <button disabled={!!busy} onClick={() => create(false)}>
              Place fields by hand
            </button>
          </div>
        </>
      )}
      {busy && <p className="busy">{busy}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
