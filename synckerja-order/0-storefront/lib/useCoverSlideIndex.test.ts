import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOneWayCoverSlide } from "./useCoverSlideIndex";

describe("useOneWayCoverSlide", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("brings the next photo in from the left and keeps that direction", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOneWayCoverSlide(2, false, 3_000));
    expect(result.current.visible).toBe(0);
    expect(result.current.incoming).toBe(1);
    expect(result.current.phase).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.phase).toBe(1);
    expect(result.current.incoming).toBe(1);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.visible).toBe(1);
    expect(result.current.incoming).toBe(0);
    expect(result.current.phase).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.phase).toBe(1);
    expect(result.current.incoming).toBe(0);
  });

  it("does not move while paused", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOneWayCoverSlide(3, true, 3_000));
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(result.current.phase).toBe(0);
    expect(result.current.visible).toBe(0);
  });
});
