import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { SettingsProvider } from "./useSettings";
import Home from "./pages/Home";
import SettingsPage from "./pages/Settings";
import TemplateNew from "./pages/TemplateNew";
import TemplateEdit from "./pages/TemplateEdit";
import Record from "./pages/Record";
import Review from "./pages/Review";

export default function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <header className="topbar">
          <NavLink to="/" className="brand">
            🎙️ Voice Form Filler
          </NavLink>
          <NavLink to="/settings" className="topbar-link" aria-label="Settings">
            ⚙️
          </NavLink>
        </header>
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/templates/new" element={<TemplateNew />} />
            <Route path="/templates/:id" element={<TemplateEdit />} />
            <Route path="/record/:templateId" element={<Record />} />
            <Route path="/review/:sessionId" element={<Review />} />
          </Routes>
        </main>
      </HashRouter>
    </SettingsProvider>
  );
}
