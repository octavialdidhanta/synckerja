import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderStoreHero } from "./OrderStoreHero";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

function renderHero(coverUrls: string[]) {
  return render(
    <OrderStoreHero
      coverUrl={coverUrls[0] ?? null}
      coverUrls={coverUrls}
      storeName="Sate Sultan PIK"
      isOpen
      hours={null}
      onSearch={() => undefined}
      onMenu={() => undefined}
      onStoreInfo={() => undefined}
    />,
  );
}

describe("OrderStoreHero cover slides", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("slides the next banner in from the left after 3 seconds", () => {
    vi.useFakeTimers();
    const { container } = renderHero(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
    const track = () => container.querySelector("[data-cover-track]");
    const sources = () => [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(sources()).toEqual(["https://example.com/b.jpg", "https://example.com/a.jpg"]);
    expect(track()?.getAttribute("style")).toContain("translateX(-50%)");
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(track()?.getAttribute("style")).toContain("translateX(0%)");
  });

  it("keeps a single banner in place", () => {
    vi.useFakeTimers();
    const { container } = renderHero(["https://example.com/a.jpg"]);
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("[data-cover-track]")?.getAttribute("style")).toContain("translateX(0%)");
  });
});
