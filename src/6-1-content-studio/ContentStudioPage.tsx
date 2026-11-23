import { AgentTab } from "./agent/AgentTab";
import { useLocation, useNavigate } from "react-router-dom";
import { FootageTab } from "./footage/FootageTab";
import { LibraryTab } from "./library/LibraryTab";
import { ReferenceTab } from "./referensi/ReferenceTab";
import { ShotListTab } from "./shots/ShotListTab";
import { CONTENT_STUDIO_BASE, STUDIO_TABS, studioTabFromPath } from "./studioTabs";
import "./contentStudio.css";

export default function ContentStudioPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = studioTabFromPath(location.pathname);

  const headLeft = (
    <>
      <h1>Content Studio</h1>
      <div className="tabs">
        {STUDIO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={(t.id === tab ? "on" : "") + (t.ready ? " link" : "")}
            disabled={!t.ready}
            title={t.ready ? t.label : "Segera"}
            onClick={() => t.ready && t.id !== tab && navigate(`${CONTENT_STUDIO_BASE}/${t.id}`)}
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
      ) : (
        <LibraryTab key={tab} kind={tab === "produk" ? "menu" : "lokasi"} headLeft={headLeft} />
      )}
    </div>
  );
}
