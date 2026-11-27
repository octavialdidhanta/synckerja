import { describe, expect, it } from "vitest";
import { footageByShot } from "./useShotData";

describe("footageByShot", () => {
  it("counts linked clips per shot, keyed by the job's ContentID", () => {
    const jobs = [
      { id: "j1", external_id: "7f2c78aa" },
      { id: "j2", external_id: "4dae0397" },
    ];
    const out = footageByShot(jobs, [
      { shot_job_id: "j1", shot_id: "S05" },
      { shot_job_id: "j1", shot_id: "s05" },
      { shot_job_id: "j2", shot_id: "P03" },
      { shot_job_id: "gone", shot_id: "P01" },
    ]);
    expect(out).toEqual({ "7f2c78aa": { S05: 2 }, "4dae0397": { P03: 1 } });
  });
});
