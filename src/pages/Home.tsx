import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteSession, deleteTemplate, listSessions, listTemplates, saveTemplate } from "../lib/storage/db";
import type { FormTemplate, Session } from "../lib/types";
import { newId } from "../lib/id";
import { useSettings } from "../useSettings";
import { downloadFile, safeFileName } from "../lib/download";

export default function Home() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const { settings, loaded } = useSettings();
  const importRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  const refresh = async () => {
    setTemplates(await listTemplates());
    setSessions(await listSessions());
  };
  useEffect(() => {
    refresh();
  }, []);

  const exportTemplate = (t: FormTemplate) => {
    const blob = new Blob([JSON.stringify(t)], { type: "application/json" });
    downloadFile(blob, safeFileName(`${t.name}.form.json`));
  };

  const importTemplate = async (file: File) => {
    try {
      const t = JSON.parse(await file.text()) as FormTemplate;
      if (!t.pages?.length || !Array.isArray(t.fields)) throw new Error("not a form file");
      await saveTemplate({ ...t, id: newId("tpl_"), createdAt: Date.now() });
      refresh();
    } catch (e) {
      alert(`Could not import: ${(e as Error).message}`);
    }
  };

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? "Deleted form";

  return (
    <>
      {loaded && !settings.anthropicKey && (
        <div className="banner">
          First, add your API key in <Link to="/settings">Settings</Link>.
        </div>
      )}

      <section>
        <h2>Forms</h2>
        {templates.length === 0 && <p className="muted">No forms yet. Photograph or upload a blank form to start.</p>}
        <ul className="cards">
          {templates.map((t) => (
            <li key={t.id} className="card">
              <div className="card-title">{t.name}</div>
              <div className="muted small">
                {t.fields.length} fields · {t.pages.length} page{t.pages.length > 1 ? "s" : ""}
              </div>
              <div className="row">
                <button className="primary" onClick={() => nav(`/record/${t.id}`)}>
                  🎙️ Start
                </button>
                <Link className="button" to={`/templates/${t.id}`}>
                  Edit
                </Link>
                <button onClick={() => exportTemplate(t)}>Export</button>
                <button
                  className="danger"
                  onClick={async () => {
                    if (confirm(`Delete form "${t.name}"?`)) {
                      await deleteTemplate(t.id);
                      refresh();
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="row">
          <Link className="button primary" to="/templates/new">
            + New form from scan
          </Link>
          <button onClick={() => importRef.current?.click()}>Import form file</button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && importTemplate(e.target.files[0])}
          />
        </div>
      </section>

      {sessions.length > 0 && (
        <section>
          <h2>Recent reports</h2>
          <ul className="cards">
            {sessions.map((s) => (
              <li key={s.id} className="card">
                <Link to={`/review/${s.id}`} className="card-title">
                  {s.title || templateName(s.templateId)}
                </Link>
                <div className="muted small">
                  {templateName(s.templateId)} · {new Date(s.createdAt).toLocaleString()}
                </div>
                <div className="row">
                  <Link className="button" to={`/review/${s.id}`}>
                    Open
                  </Link>
                  <button
                    className="danger"
                    onClick={async () => {
                      if (confirm("Delete this report and its recording?")) {
                        await deleteSession(s);
                        refresh();
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
