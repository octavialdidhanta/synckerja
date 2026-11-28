import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { AgentTab } from "./agent/AgentTab";
import { ClaimsTab } from "./claims/ClaimsTab";
import { FootageTab } from "./footage/FootageTab";
import { LibraryTab } from "./library/LibraryTab";
import { ReferenceTab } from "./referensi/ReferenceTab";
import { SettingsTab } from "./settings/SettingsTab";
import { ShotListTab } from "./shots/ShotListTab";
import {
  CONTENT_STUDIO_BASE,
  STUDIO_TABS,
  contentStudioReturnPath,
  studioTabFromPath,
} from "./studioTabs";
import "./contentStudio.css";

export default function ContentStudioPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = studioTabFromPath(location.pathname);
  const returnTo = contentStudioReturnPath(location.state);

  const goBack = () => {
    navigate(returnTo);
  };

  const openStudioTab = (id: string) => {
    navigate(`${CONTENT_STUDIO_BASE}/${id}`, { state: location.state });
  };

  const headLeft = (
    <>
      <div className="ck-title">
        <button type="button" className="ck-back" onClick={goBack} aria-label="Kembali" title="Kembali">
          <ArrowLeft aria-hidden />
        </button>
        <h1>Content Studio</h1>
      </div>
      <div className="tabs">
        {STUDIO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={(t.id === tab ? "on" : "") + (t.ready ? " link" : "")}
            disabled={!t.ready}
            title={t.ready ? t.label : "Segera"}
            onClick={() => t.ready && t.id !== tab && openStudioTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>
  );

  // Full bleed: the studio fills everything right of the sidebar and below the app header.
  return (
    <div className="ck ck-full">
      {tab === "footage" ? (
        <FootageTab headLeft={headLeft} />
      ) : tab === "shot-list" ? (
        <ShotListTab headLeft={headLeft} />
      ) : tab === "referensi" ? (
        <ReferenceTab headLeft={headLeft} />
      ) : tab === "agent" ? (
        <AgentTab headLeft={headLeft} />
      ) : tab === "klaim" ? (
        <ClaimsTab headLeft={headLeft} />
      ) : tab === "pengaturan" ? (
        <SettingsTab headLeft={headLeft} />
      ) : (
        <LibraryTab key={tab} kind={tab === "produk" ? "menu" : "lokasi"} headLeft={headLeft} />
      )}
    </div>
  );
}
