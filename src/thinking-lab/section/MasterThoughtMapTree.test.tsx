import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MasterThoughtMapTree, panToCenter, settleCurves, type MasterMapChild } from "@/thinking-lab/section/MasterThoughtMapTree";
import type { LabMasterThought, MasterThoughtFacts } from "@/thinking-lab/master-thought/types";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string, variables?: Record<string, string | number>) => {
      const template = fallback ?? _key;
      if (!variables) return template;
      return Object.entries(variables).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        template,
      );
    },
  }),
}));

function master(id: string, statement: string): LabMasterThought {
  return {
    id,
    organizationId: "org",
    originalInput: statement,
    priorBelief: "",
    audience: "",
    statement,
    rootBelief: statement,
    confirmationSource: "original",
    confirmedAt: null,
    mtStatus: "locked",
    status: "active",
    canonicalSemantic: null,
    semanticFingerprint: "fp",
    lastAudit: null,
    updatedAt: "",
  };
}

function renderMap(children: MasterMapChild[], inspected: Partial<{
  thoughtId: string | null;
  territoryId: string | null;
  angleId: string | null;
  ideaId: string | null;
}> = {}) {
  render(
    <MasterThoughtMapTree
      masters={[master("m1", "Uang muda lebih baik ditabung")]}
      selectedId="m1"
      inspectedMasterId="m1"
      inspectedThoughtId={inspected.thoughtId ?? null}
      inspectedTerritoryId={inspected.territoryId ?? null}
      inspectedAngleId={inspected.angleId ?? null}
      inspectedIdeaId={inspected.ideaId ?? null}
      childrenByMasterId={new Map([["m1", children]])}
      onSelect={vi.fn()}
      onSelectChild={vi.fn()}
      onSelectTerritory={vi.fn()}
      onSelectAngle={vi.fn()}
      onSelectIdea={vi.fn()}
      onRequestEdit={vi.fn()}
      onRequestDelete={vi.fn()}
    />,
  );
}

describe("MasterThoughtMapTree pills", () => {
  it("opens only the selected Big Thought and keeps a closed sibling's count", () => {
    renderMap(
      [
        {
          id: "bt1",
          code: "BT01",
          label: "Keinginan punya kedaluwarsa",
          statement: "Uang di usia muda lebih berharga ditabung, karena keinginan untuk modif punya masa kedaluwarsa.",
          childCount: 2,
          territories: [{ id: "t1", code: "TR01", statement: "Mantan anak motor", childCount: 1 }],
        },
        {
          id: "bt2",
          code: "BT02",
          label: "Uang butuh waktu untuk tumbuh",
          statement: "Alasan yang lain.",
          childCount: 3,
        },
      ],
      { thoughtId: "bt1" },
    );

    expect(screen.getByRole("button", { name: /Keinginan punya kedaluwarsa/ })).toBeTruthy();
    expect(screen.queryByText(/karena keinginan untuk modif/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Mantan anak motor/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Keinginan punya kedaluwarsa/ }));
    expect(screen.getByRole("button", { name: /Mantan anak motor/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Uang butuh waktu untuk tumbuh/ })).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.queryByText("Pasar motor bekas modif")).toBeNull();
  });

  it("stars only an Idea whose cause is locked and whose down-top still passes", () => {
    renderMap(
      [
        {
          id: "bt1",
          code: "BT01",
          label: "Keinginan",
          statement: "Alasan",
          childCount: 1,
          territories: [
            {
              id: "t1",
              code: "TR01",
              statement: "Mantan anak motor",
              childCount: 1,
              angles: [
                {
                  id: "a1",
                  code: "AN01",
                  statement: "Motor kebanggaan kini nganggur",
                  childCount: 2,
                  ideas: [
                    { id: "i1", code: "ID01", statement: "Buka Terpal", recommended: true },
                    { id: "i2", code: "ID02", statement: "Foto Dulu", recommended: false },
                  ],
                },
              ],
            },
          ],
        },
      ],
      { thoughtId: "bt1", territoryId: "t1", angleId: "a1" },
    );

    fireEvent.click(screen.getByRole("button", { name: /Keinginan/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mantan anak motor/ }));
    fireEvent.click(screen.getByRole("button", { name: /Motor kebanggaan kini nganggur/ }));
    expect(screen.getByRole("button", { name: /Buka Terpal/ }).querySelector("[aria-label='Recommended to start']")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Foto Dulu/ }).querySelector("[aria-label='Recommended to start']")).toBeNull();
  });

  it("shows an Idea as a short summary and keeps the full sentence on hover", () => {
    const statement =
      "Kita menunjukkan seorang mantan profesional yang pensiun dini dan kini menghabiskan waktunya untuk menulis buku-buku inspiratif atau menciptakan karya seni yang mendidik.";
    renderMap(
      [
        {
          id: "bt1",
          code: "BT01",
          label: "Keinginan",
          statement: "Alasan",
          childCount: 1,
          territories: [
            {
              id: "t1",
              code: "TR01",
              statement: "Pensiun dini",
              childCount: 1,
              angles: [
                {
                  id: "a1",
                  code: "AN01",
                  statement: "Waktu kerja bunga",
                  childCount: 1,
                  ideas: [
                    { id: "i1", code: "ID04", statement },
                    { id: "i2", code: "ID01", statement: "Buka Terpal" },
                  ],
                },
              ],
            },
          ],
        },
      ],
      { thoughtId: "bt1", territoryId: "t1", angleId: "a1" },
    );
    fireEvent.click(screen.getByRole("button", { name: /Keinginan/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pensiun dini/ }));
    fireEvent.click(screen.getByRole("button", { name: /Waktu kerja bunga/ }));
    const idea = screen.getByRole("button", { name: "Mantan profesional menulis buku-buku inspiratif" });
    const short = screen.getByRole("button", { name: "Buka Terpal" });
    expect(idea.getAttribute("title")).toBe(statement);
    expect(idea.className).toContain("w-full");
    expect(short.className).toContain("w-full");
    expect(idea.parentElement?.parentElement?.parentElement).toBe(short.parentElement?.parentElement?.parentElement);
    expect(screen.queryByRole("button", { name: statement })).toBeNull();
    expect(screen.getByRole("button", { name: /Keinginan/ }).textContent).toContain("BT01");
    expect(screen.getByRole("button", { name: /Pensiun dini/ }).textContent).toContain("TR01");
    expect(screen.getByRole("button", { name: /Waktu kerja bunga/ }).textContent).toContain("AN01");
    expect(idea.textContent).toContain("ID04");
    expect(short.textContent).toContain("ID01");
    expect(screen.getByRole("button", { name: /Pensiun dini/ }).textContent).toContain("Territory");
    expect(screen.getByRole("button", { name: /Waktu kerja bunga/ }).textContent).toContain("Angle");
    expect(idea.textContent).toContain("Idea");
    expect(short.textContent).toContain("Idea");
    expect(screen.getAllByText("Master Thought").some((node) => node.closest("button"))).toBe(true);
  });

  it("stretches Big Thought, Territory, and Angle nodes to the longest sibling", () => {
    renderMap(
      [
        {
          id: "bt1",
          code: "BT01",
          label: "Bunga",
          statement: "Alasan pendek",
          childCount: 2,
          territories: [
            {
              id: "t1",
              code: "TR01",
              statement: "Pensiun",
              childCount: 2,
              angles: [
                {
                  id: "a1",
                  code: "AN01",
                  statement: "Waktu singkat",
                  childCount: 0,
                },
                {
                  id: "a2",
                  code: "AN02",
                  statement: "Kebebasan finansial yang datang dari menabung sejak muda",
                  childCount: 0,
                },
              ],
            },
            {
              id: "t2",
              code: "TR02",
              statement: "Pensiun dini bersama komunitas",
              childCount: 0,
            },
          ],
        },
        {
          id: "bt2",
          code: "BT02",
          label: "Bunga majemuk jangka panjang",
          statement: "Alasan yang lebih panjang dari label",
          childCount: 0,
        },
      ],
      { thoughtId: "bt1", territoryId: "t1" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Bunga" }));
    fireEvent.click(screen.getByRole("button", { name: "Pensiun" }));
    const thought = screen.getByRole("button", { name: "Bunga" });
    const thoughtSibling = screen.getByRole("button", { name: "Bunga majemuk jangka panjang" });
    const territory = screen.getByRole("button", { name: "Pensiun" });
    const territorySibling = screen.getByRole("button", { name: "Pensiun dini bersama komunitas" });
    const angle = screen.getByRole("button", { name: "Waktu singkat" });
    const angleSibling = screen.getByRole("button", { name: "Kebebasan finansial yang datang" });
    for (const node of [thought, thoughtSibling, territory, territorySibling, angle, angleSibling]) {
      expect(node.className).toContain("w-full");
    }
    expect(thought.parentElement?.parentElement?.parentElement).toBe(
      thoughtSibling.parentElement?.parentElement?.parentElement,
    );
    expect(territory.parentElement?.parentElement?.parentElement).toBe(
      territorySibling.parentElement?.parentElement?.parentElement,
    );
    expect(angle.parentElement?.parentElement?.parentElement).toBe(
      angleSibling.parentElement?.parentElement?.parentElement,
    );
    expect(thoughtSibling.getAttribute("title")).toBe("Alasan yang lebih panjang dari label");
  });

  it("shows a node's details on the first click, then hides and opens its children", () => {
    const onSelect = vi.fn();
    const onSelectChild = vi.fn();
    const children: MasterMapChild[] = [
      {
        id: "bt1",
        code: "BT01",
        label: "Identitas Dini",
        statement: "Alasan",
        childCount: 1,
        territories: [{ id: "t1", code: "TR01", statement: "Turunan terbuka", childCount: 0 }],
      },
    ];
    const props = {
      masters: [master("m1", "Prioritas motor")],
      selectedId: "m1",
      inspectedMasterId: "m1",
      inspectedTerritoryId: null,
      inspectedAngleId: null,
      inspectedIdeaId: null,
      childrenByMasterId: new Map([["m1", children]]),
      onSelect,
      onSelectChild,
      onSelectTerritory: vi.fn(),
      onSelectAngle: vi.fn(),
      onSelectIdea: vi.fn(),
      onRequestEdit: vi.fn(),
      onRequestDelete: vi.fn(),
    };
    const { rerender } = render(
      <MasterThoughtMapTree {...props} inspectedThoughtId="bt1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Prioritas motor" }));
    expect(onSelect).toHaveBeenCalledWith("m1");
    expect(screen.getByRole("button", { name: /Identitas Dini/ })).toBeTruthy();

    rerender(<MasterThoughtMapTree {...props} inspectedThoughtId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Prioritas motor" }));
    expect(screen.queryByRole("button", { name: /Identitas Dini/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Prioritas motor" }));
    expect(screen.getByRole("button", { name: /Identitas Dini/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Turunan terbuka/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Identitas Dini/ }));
    expect(onSelectChild).toHaveBeenCalledWith("m1", "bt1");
    expect(screen.queryByRole("button", { name: /Turunan terbuka/ })).toBeNull();
    rerender(<MasterThoughtMapTree {...props} inspectedThoughtId="bt1" />);
    fireEvent.click(screen.getByRole("button", { name: /Identitas Dini/ }));
    expect(screen.getByRole("button", { name: /Turunan terbuka/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Identitas Dini/ }));
    expect(screen.queryByRole("button", { name: /Turunan terbuka/ })).toBeNull();
  });

  it("names the Master Thought node with its subject", () => {
    const row = master("m1", "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang.");
    row.canonicalSemantic = {
      outcome: "ORIGINAL_READY",
      subject: "Uang muda",
      proposedRootBelief: null,
      formulationNote: null,
      clarificationQuestion: null,
      clarificationOptions: null,
      resolution: "RESOLVED",
      unresolvedReasons: [],
    } satisfies MasterThoughtFacts;
    render(
      <MasterThoughtMapTree
        masters={[row]}
        selectedId="m1"
        inspectedMasterId="m1"
        inspectedThoughtId={null}
        inspectedTerritoryId={null}
        inspectedAngleId={null}
        inspectedIdeaId={null}
        childrenByMasterId={new Map()}
        onSelect={vi.fn()}
        onSelectChild={vi.fn()}
        onSelectTerritory={vi.fn()}
        onSelectAngle={vi.fn()}
        onSelectIdea={vi.fn()}
        onRequestEdit={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Uang muda" })).toBeTruthy();
  });

  it("draws only the selected master on the canvas", () => {
    const { container } = render(
      <MasterThoughtMapTree
        masters={[master("m1", "Akar satu"), master("m2", "Akar dua")]}
        selectedId="m1"
        inspectedMasterId="m1"
        inspectedThoughtId={null}
        inspectedTerritoryId={null}
        inspectedAngleId={null}
        inspectedIdeaId={null}
        childrenByMasterId={
          new Map([
            ["m1", [{ id: "bt1", code: "BT01", statement: "Anak satu" }]],
            ["m2", [{ id: "bt9", code: "BT09", statement: "Anak dua" }]],
          ])
        }
        onSelect={vi.fn()}
        onSelectChild={vi.fn()}
        onSelectTerritory={vi.fn()}
        onSelectAngle={vi.fn()}
        onSelectIdea={vi.fn()}
        onRequestEdit={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    const canvas = container.querySelector("[data-map-canvas]");
    expect(canvas?.querySelectorAll("[data-map-node='master:m1']")).toHaveLength(1);
    expect(canvas?.querySelector("[data-map-node='master:m2']")).toBeNull();
    expect(canvas?.textContent).not.toContain("Anak dua");
    expect(screen.getByRole("button", { name: "Akar dua" }).closest("[data-map-canvas]")).toBeNull();
  });

  it("keeps a measured root curve when a later measure is empty", () => {
    expect(settleCurves(["M 1 1 C 2 1, 2 2, 3 2"], [], 1)).toEqual(["M 1 1 C 2 1, 2 2, 3 2"]);
    const box = (x: number, y: number, width: number, height: number) =>
      ({ left: x, top: y, right: x + width, bottom: y + height, width, height, x, y, toJSON() { return {}; } }) as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const id = this.getAttribute("data-map-node");
      if (id === "master:m1") return box(0, 40, 120, 24);
      if (id === "bt:bt1") return box(220, 8, 90, 20);
      if (id === "bt:bt2") return box(220, 48, 90, 20);
      return box(0, 0, 400, 200);
    });
    const { container } = render(
      <MasterThoughtMapTree
        masters={[master("m1", "Akar satu")]}
        selectedId="m1"
        inspectedMasterId="m1"
        inspectedThoughtId={null}
        inspectedTerritoryId={null}
        inspectedAngleId={null}
        inspectedIdeaId={null}
        childrenByMasterId={
          new Map([
            [
              "m1",
              [
                { id: "bt1", code: "BT01", statement: "Anak satu" },
                { id: "bt2", code: "BT02", statement: "Anak dua" },
              ],
            ],
          ])
        }
        onSelect={vi.fn()}
        onSelectChild={vi.fn()}
        onSelectTerritory={vi.fn()}
        onSelectAngle={vi.fn()}
        onSelectIdea={vi.fn()}
        onRequestEdit={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("svg path")).toHaveLength(2);
    spy.mockImplementation(() => box(0, 0, 0, 0));
    const viewport = container.querySelector("[data-map-canvas]")?.parentElement;
    if (viewport) fireEvent.wheel(viewport, { deltaY: -100, clientX: 10, clientY: 10 });
    expect(container.querySelectorAll("svg path")).toHaveLength(2);
    spy.mockRestore();
  });

  it("pans a clicked node to the viewport center", () => {
    expect(
      panToCenter({
        viewport: { left: 0, top: 0, width: 800, height: 400 },
        node: { left: 600, top: 40, width: 120, height: 40 },
      }),
    ).toEqual({ x: -260, y: 140 });
    expect(
      panToCenter({
        viewport: { left: 10, top: 20, width: 200, height: 100 },
        node: { left: 90, top: 50, width: 40, height: 40 },
      }),
    ).toBeNull();
  });

  it("offers Generate Territory only beside the selected empty Big Thought", () => {
    const onGenerateTerritory = vi.fn();
    const onSelectChild = vi.fn();
    render(
      <MasterThoughtMapTree
        masters={[master("m1", "Uang muda lebih baik ditabung")]}
        selectedId="m1"
        inspectedMasterId="m1"
        inspectedThoughtId="bt1"
        inspectedTerritoryId={null}
        inspectedAngleId={null}
        inspectedIdeaId={null}
        territoryGenerateThoughtId="bt1"
        onGenerateTerritory={onGenerateTerritory}
        childrenByMasterId={
          new Map([
            [
              "m1",
              [
                {
                  id: "bt1",
                  code: "BT01",
                  label: "Durasi Pertumbuhan",
                  statement: "Waktu untuk pertumbuhan investasi lebih panjang.",
                  territories: [{ id: "t1", code: "TR01", statement: "Uang jajan" }],
                },
                { id: "bt2", code: "BT02", label: "Uang butuh waktu", statement: "Alasan lain." },
              ],
            ],
          ])
        }
        onSelect={vi.fn()}
        onSelectChild={onSelectChild}
        onSelectTerritory={vi.fn()}
        onSelectAngle={vi.fn()}
        onSelectIdea={vi.fn()}
        onRequestEdit={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    const generate = screen.getAllByRole("button", { name: "Generate Territory" });
    expect(generate).toHaveLength(1);
    expect(generate[0].closest("[data-map-node='bt:bt1']")).toBeTruthy();
    fireEvent.click(generate[0]);
    expect(onGenerateTerritory).toHaveBeenCalledWith("bt1");
    expect(onSelectChild).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Uang jajan" })).toBeNull();
  });

  it("shows an Angle node as its subject, not the full observation", () => {
    const statement =
      "Pakaian tren musiman mendorong pembelian berulang, namun justru menciptakan beban penyimpanan atau pembuangan yang terus-menerus.";
    renderMap([
      {
        id: "bt1",
        code: "BT01",
        label: "Erosi Nilai",
        statement: "Alasan",
        territories: [
          {
            id: "t1",
            code: "TR01",
            statement: "Pakaian tren musiman",
            angles: [{ id: "a1", code: "AN01", statement }],
          },
        ],
      },
    ], { thoughtId: "bt1", territoryId: "t1" });
    fireEvent.click(screen.getByRole("button", { name: /Erosi Nilai/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pakaian tren musiman/ }));
    const node = screen.getByRole("button", { name: "Pembelian berulang" });
    expect(node.getAttribute("title")).toBe(statement);
    expect(screen.queryByRole("button", { name: /beban penyimpanan/ })).toBeNull();
  });
});
