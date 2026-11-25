import type { FormTemplate } from "../src/lib/types";

// 1×1 white PNG
export const WHITE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

export const gateTemplate: FormTemplate = {
  id: "tpl_test",
  name: "Prüfbericht Feuerschutztor",
  language: "de",
  createdAt: 0,
  pages: [{ image: WHITE_PNG, width: 1000, height: 1414 }],
  fields: [
    { id: "datum", label: "Datum", description: "Prüfdatum", type: "date", required: true, page: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.03 } },
    { id: "standort", label: "Standort", description: "Gebäude/Ort des Tores", type: "text", required: true, page: 0, box: { x: 0.5, y: 0.1, w: 0.4, h: 0.03 } },
    { id: "dichtung_ok", label: "Dichtung – i.O.", description: "Dichtungen intakt", type: "checkbox", required: false, page: 0, box: { x: 0.8, y: 0.3, w: 0.03, h: 0.02 } },
    { id: "ergebnis", label: "Ergebnis", description: "Gesamtergebnis", type: "choice", options: ["bestanden", "Mängel", "nicht bestanden"], required: true, page: 0, box: { x: 0.1, y: 0.5, w: 0.3, h: 0.03 } },
    { id: "unterschrift", label: "Unterschrift", description: "", type: "signature", required: true, page: 0, box: { x: 0.1, y: 0.9, w: 0.3, h: 0.05 } },
  ],
};
