import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { OrderStorefrontPage } from "./pages/OrderStorefrontPage";

const orderQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** Hostname-only mini-app for public QR dine-in (`/{code}`). Expects `I18nextProvider` from `main.tsx`. */
export function OrderStoreApp() {
  return (
    <QueryClientProvider client={orderQueryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/:code" element={<OrderStorefrontPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
