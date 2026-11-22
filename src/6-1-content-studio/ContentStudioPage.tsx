import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeaderAndTab } from "@/6-1-content-calendar/container/HeaderAndTab";
import { FootageTab } from "./footage/FootageTab";
import { LibraryTab } from "./library/LibraryTab";
import { CONTENT_STUDIO_BASE, STUDIO_TABS, studioTabFromPath } from "./studioTabs";
import "./contentStudio.css";

export default function ContentStudioPage() {
  const [mainTab, setMainTab] = useState("content-studio");
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

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="mb-1 flex-shrink-0">
          <HeaderAndTab activeMainTab={mainTab} handleTabChange={setMainTab} />
        </div>
        <div className="ck mt-3">
          {tab === "footage" ? (
            <FootageTab headLeft={headLeft} />
          ) : (
            <LibraryTab key={tab} kind={tab === "produk" ? "menu" : "lokasi"} headLeft={headLeft} />
          )}
        </div>
      </div>
    </div>
  );
}
