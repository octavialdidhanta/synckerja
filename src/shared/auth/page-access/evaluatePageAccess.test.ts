import { describe, expect, it } from "vitest";
import { evaluatePageAccess, type PageAccessConfig } from "./evaluatePageAccess";

const employee = { roles: ["employee"], primaryRole: "employee", employeeId: "emp-1" };

describe("evaluatePageAccess", () => {
  it("allows an unconfigured path in the UI and denies it for the gateway", () => {
    expect(evaluatePageAccess("/tools/calculator", [], employee, "allow")).toBe(true);
    expect(evaluatePageAccess("/digital-marketing/social-media", [], employee, "deny")).toBe(false);
  });

  it("denies a child path when a parent row denies the role", () => {
    const configs: PageAccessConfig[] = [
      { page_path: "/omnichannel", roles_allowed: [] },
      { page_path: "/omnichannel/settings", roles_allowed: ["employee"] },
    ];
    expect(evaluatePageAccess("/omnichannel/settings", configs, employee, "deny")).toBe(false);
  });

  it("allows a child path when every matching ancestor allows the role", () => {
    const configs: PageAccessConfig[] = [
      { page_path: "/omnichannel", roles_allowed: ["employee"] },
      { page_path: "/omnichannel/settings", roles_allowed: ["employee"] },
    ];
    expect(evaluatePageAccess("/omnichannel/settings", configs, employee, "deny")).toBe(true);
  });

  it("lets an owner through a configured page that does not list owner", () => {
    const configs: PageAccessConfig[] = [
      { page_path: "/digital-marketing/social-media", roles_allowed: ["admin"] },
    ];
    expect(
      evaluatePageAccess(
        "/digital-marketing/social-media/dashboard",
        configs,
        { roles: ["owner"], primaryRole: "owner" },
        "deny",
      ),
    ).toBe(true);
  });

  it("denies an employee who is not in roles_allowed", () => {
    const configs: PageAccessConfig[] = [
      { page_path: "/digital-marketing/social-media", roles_allowed: ["admin"] },
    ];
    expect(
      evaluatePageAccess("/digital-marketing/social-media", configs, employee, "deny"),
    ).toBe(false);
  });

  it("allows an employee exception even when the job level does not match", () => {
    const configs: PageAccessConfig[] = [
      {
        page_path: "/digital-marketing",
        roles_allowed: ["employee"],
        job_levels_allowed: ["lead"],
        exceptions: ["emp-1"],
      },
    ];
    expect(
      evaluatePageAccess(
        "/digital-marketing/social-media",
        configs,
        { ...employee, jobLevelName: "staff" },
        "deny",
      ),
    ).toBe(true);
  });

  it("requires a matching job level when the row lists levels and the user is not an exception", () => {
    const configs: PageAccessConfig[] = [
      {
        page_path: "/digital-marketing",
        roles_allowed: ["employee"],
        job_levels_allowed: ["lead"],
      },
    ];
    expect(
      evaluatePageAccess(
        "/digital-marketing/social-media",
        configs,
        { ...employee, jobLevelName: "staff" },
        "deny",
      ),
    ).toBe(false);
    expect(
      evaluatePageAccess(
        "/digital-marketing/social-media",
        configs,
        { ...employee, jobLevelName: "Lead" },
        "deny",
      ),
    ).toBe(true);
  });

  it("allows an exception path without a matching role", () => {
    const configs: PageAccessConfig[] = [
      {
        page_path: "/recruitment",
        roles_allowed: ["admin"],
        exception_paths: ["/recruitment/interviewees"],
      },
    ];
    expect(evaluatePageAccess("/recruitment/interviewees", configs, employee, "deny")).toBe(true);
    expect(evaluatePageAccess("/recruitment/job-openings", configs, employee, "deny")).toBe(false);
  });

  it("treats manager as employee", () => {
    const configs: PageAccessConfig[] = [
      { page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] },
    ];
    expect(
      evaluatePageAccess(
        "/digital-marketing/social-media",
        configs,
        { roles: ["manager"], primaryRole: "manager" },
        "deny",
      ),
    ).toBe(true);
  });
});
