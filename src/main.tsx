import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { registerSW } from "virtual:pwa-register";
import i18n from "@/shared/i18n/index.ts";
import App from "./App.tsx";
import "./index.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>,
);
