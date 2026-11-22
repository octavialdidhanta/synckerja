import { useState } from "react";
import { HeaderAndTab } from "@/6-1-content-calendar/container/HeaderAndTab";
import { FootageTab } from "./footage/FootageTab";
import "./contentStudio.css";

const STUDIO_TABS = [
  { id: "footage", label: "Footage", ready: true },
  { id: "menu", label: "Produk", ready: false },
  { id: "lokasi", label: "Lokasi", ready: false },
  { id: "shot", label: "Shot List", ready: false },
  { id: "ref", label: "Referensi", ready: false },
] as const;

export default function ContentStudioPage() {
  const [mainTab, setMainTab] = useState("content-studio");

  const headLeft = (
    <>
      <h1>Content Studio</h1>
      <div className="tabs">
        {STUDIO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === "footage" ? "on" : ""}
            disabled={!t.ready}
            title={t.ready ? t.label : "Segera"}
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
          <FootageTab headLeft={headLeft} />
        </div>
      </div>
    </div>
  );
}
