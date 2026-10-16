import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LabNodeInspector } from "@/thinking-lab/section/LabNodeInspector";

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

function openActionMenu(name: string | RegExp = "More actions") {
  const trigger = screen.getByRole("button", { name });
  fireEvent.keyDown(trigger, { key: "Enter" });
}

describe("LabNodeInspector territory entry", () => {
  it("keeps the Big Thought definition behind an Indonesian info mark", () => {
    render(<LabNodeInspector kind="bigThought" code="BT01" statement="Dana perpuluhan adalah sumbangan sukarela." />);
    expect(screen.queryByText(/supporting belief/i)).toBeNull();
    expect(screen.queryByText(/keyakinan pendukung/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Definisi Big Thought" }));
    expect(screen.getByText(/Master Thought benar karena alasan ini/i)).toBeTruthy();
    expect(screen.getByText(/kehilangan satu alasan untuk dipercaya/i)).toBeTruthy();
  });

  it("offers Generate Territory on an empty Big Thought that can start one", () => {
    const onGenerateTerritory = vi.fn();
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT04"
        statement="Uang di usia muda lebih berharga ditabung, karena kebiasaan mengelola uang."
        onGenerateTerritory={onGenerateTerritory}
      />,
    );
    openActionMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Generate Territory" }));
    expect(onGenerateTerritory).toHaveBeenCalledOnce();
  });

  it("keeps Write a Territory and Generate Territory off an empty Big Thought inspector", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT03"
        statement="Kelalaian dalam memilih penerima dapat merusak niat awal pemberi."
      />,
    );
    expect(screen.queryByRole("button", { name: "Generate Territory" })).toBeNull();
    expect(screen.queryByText("Write a Territory")).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlock" })).toBeNull();
  });

  it("offers Audit for an admitted territory set", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT02"
        statement="A locked big thought"
        territories={[{ id: "t1", code: "TR01", statement: "First space", verdict: null }]}
        territoryStage="audit"
        onTerritoryStage={vi.fn()}
      />,
    );
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Audit" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buat ulang Angle" })).toBeNull();
  });

  it("groups sibling conflicts so each pair can be read on its own", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT01"
        statement="A locked big thought"
        territories={[
          { id: "t2", code: "TR02", statement: "Symbolic and functional giving.", verdict: "AUDIT_FAIL" },
          { id: "t3", code: "TR03", statement: "Duty versus trust.", verdict: "AUDIT_FAIL" },
        ]}
        territoryNotes={[
          { kind: "overlap", a: "TR01", b: "TR02", explanation: "Both host the same functional angle." },
          { kind: "containment", container: "TR02", contained: "TR01", explanation: "TR02 already includes TR01." },
        ]}
        territoryStage="fix"
        onTerritoryStage={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Why these Territories failed" })).toBeTruthy();
    expect(screen.getByText("Why these Territories failed")).toBeTruthy();
    expect(screen.getByText("Overlap")).toBeTruthy();
    expect(screen.getByText("TR01 · TR02")).toBeTruthy();
    expect(screen.getByText("Both host the same functional angle.")).toBeTruthy();
    expect(screen.getByText("One space covers another")).toBeTruthy();
    expect(screen.getByText("TR02 already includes TR01.")).toBeTruthy();
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Fix" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove TR02" })).toBeNull();
  });

  it("lets the user remove either failed side of a pairwise containment", () => {
    const onRemoveCoveringTerritory = vi.fn();
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT01"
        statement="A locked big thought"
        territories={[
          { id: "t1", code: "TR01", statement: "The narrower space.", verdict: "AUDIT_FAIL" },
          { id: "t2", code: "TR02", statement: "The covering space.", verdict: "AUDIT_FAIL" },
          { id: "t3", code: "TR03", statement: "A distinct space.", verdict: "AUDIT_PASS" },
        ]}
        territoryNotes={[
          {
            kind: "containment",
            container: "TR02",
            contained: "TR01",
            explanation: "TR02 already includes TR01.",
          },
        ]}
        onRemoveCoveringTerritory={onRemoveCoveringTerritory}
      />,
    );
    expect(screen.queryByRole("button", { name: "Fix" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove TR03" })).toBeNull();
    expect(
      screen.getByText("Fix already ran. Remove one failed Territory from this conflict. The next step appears after it is gone."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove TR01" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove TR02" }));
    expect(onRemoveCoveringTerritory.mock.calls).toEqual([["TR01"], ["TR02"]]);
  });

  it("offers removal only for the broad Territory when the spaces it covers still pass", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT01"
        statement="A locked big thought"
        territories={[
          { id: "t1", code: "TR01", statement: "A distinct space.", verdict: "AUDIT_PASS" },
          { id: "t3", code: "TR03", statement: "Another distinct space.", verdict: "AUDIT_PASS" },
          { id: "t5", code: "TR05", statement: "The space that swallows both.", verdict: "AUDIT_FAIL" },
        ]}
        territoryNotes={[
          { kind: "containment", container: "TR05", contained: "TR01", explanation: "TR05 covers TR01." },
          { kind: "containment", container: "TR05", contained: "TR03", explanation: "TR05 covers TR03." },
        ]}
        onRemoveCoveringTerritory={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove TR05" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove TR01" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove TR03" })).toBeNull();
  });

  it("shows Challenger alone while three passing territories still need a challenger", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT01"
        statement="A locked big thought"
        territories={[
          { id: "t2", code: "TR02", statement: "Symbolic and functional giving.", verdict: "AUDIT_PASS" },
          { id: "t3", code: "TR03", statement: "Genuine giving versus implied pressure.", verdict: "AUDIT_PASS" },
          { id: "t4", code: "TR04", statement: "Altruism versus expected return.", verdict: "AUDIT_PASS" },
        ]}
        territoryStage="challenger"
        onTerritoryStage={vi.fn()}
      />,
    );
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Challenger" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lock" })).toBeNull();
  });

  it("offers removal only for the failed side of an overlap with territories that still pass", () => {
    const onRemoveCoveringTerritory = vi.fn();
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT01"
        statement="A locked big thought"
        territories={[
          { id: "t2", code: "TR02", statement: "Symbolic and functional giving.", verdict: "AUDIT_PASS" },
          { id: "t3", code: "TR03", statement: "Genuine giving versus implied pressure.", verdict: "AUDIT_PASS" },
          { id: "t4", code: "TR04", statement: "The overlapping motivation spectrum.", verdict: "AUDIT_FAIL" },
        ]}
        territoryNotes={[
          { kind: "overlap", a: "TR02", b: "TR04", explanation: "TR04 repeats the functional dimension of TR02." },
          { kind: "overlap", a: "TR03", b: "TR04", explanation: "TR04 repeats the private-motive space of TR03." },
        ]}
        onRemoveCoveringTerritory={onRemoveCoveringTerritory}
      />,
    );
    expect(screen.queryByRole("button", { name: "Remove TR02" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove TR03" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove TR04" }));
    expect(onRemoveCoveringTerritory.mock.calls).toEqual([["TR04"]]);
    expect(screen.queryByText("Fix already ran once. This set stays open until an audit passes.")).toBeNull();
  });

  it("keeps Audit visible while Generate Territory is still running", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT02"
        statement="A locked big thought"
        territories={[{ id: "t1", code: "TR01", statement: "First space", verdict: null }]}
        territoryStage="audit"
        onTerritoryStage={vi.fn()}
        pendingAction="generate-territory"
      />,
    );
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Audit" }).getAttribute("aria-busy")).toBe("true");
  });

  it("keeps Generate Territory off the Master Thought inspector", () => {
    render(
      <LabNodeInspector
        kind="master"
        statement="A locked worldview"
        onUnlock={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Unlock" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate Territory" })).toBeNull();
  });

  it("shows the short Big Thought name above the because sentence", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT02"
        title="Uang butuh waktu untuk tumbuh"
        statement="Uang di usia muda lebih berharga ditabung, karena uang yang ditabung paling awal punya waktu paling lama untuk bertambah."
      />,
    );
    expect(screen.getByRole("heading", { name: "Uang butuh waktu untuk tumbuh" })).toBeTruthy();
    expect(screen.getByText(/karena uang yang ditabung paling awal/)).toBeTruthy();
    expect(screen.getByText("Big Thought - BT02")).toBeTruthy();
  });

  it("shows the sealed subject and the unlock note when a locked parent has none", () => {
    const { rerender } = render(
      <LabNodeInspector kind="master" statement="A locked worldview" subject="the courier" />,
    );
    expect(screen.getByRole("heading", { name: "the courier" })).toBeTruthy();
    expect(screen.getByText("A locked worldview")).toBeTruthy();
    rerender(
      <LabNodeInspector
        kind="master"
        statement="A locked worldview"
        subjectNotice="This locked Master Thought has no subject yet. Unlock it, then understand it again so the subject is saved."
      />,
    );
    expect(screen.getByText(/Unlock it, then understand it again/i)).toBeTruthy();
  });

  it("lists the path upward from the selected node", () => {
    render(
      <LabNodeInspector
        kind="territory"
        statement="Mantan anak motor"
        pathUp={[
          { label: "Big Thought", title: "Keinginan punya kedaluwarsa" },
          { label: "Master Thought", title: "Uang muda lebih baik ditabung" },
        ]}
      />,
    );
    expect(screen.getByText("Path up")).toBeTruthy();
    expect(screen.getByText("Keinginan punya kedaluwarsa")).toBeTruthy();
    expect(screen.getByText("Uang muda lebih baik ditabung")).toBeTruthy();
  });

  it("lists a Big Thought question when proof cannot appear", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT01"
        statement="A reason"
        questionNotes={["AN01 · ID02: this reason cannot be shown"]}
      />,
    );
    expect(screen.getByText("Question this Big Thought")).toBeTruthy();
    expect(screen.getByText("AN01 · ID02: this reason cannot be shown")).toBeTruthy();
  });

  it("lists territories on a Big Thought without their angles", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT03"
        statement="A locked big thought"
        territories={[
          {
            id: "t1",
            code: "TR01",
            statement: "First space",
            canGenerateAngle: true,
            angles: [{ id: "a1", code: "AN01", statement: "One point of view", relation: "VALID_ANGLE" }],
          },
          {
            id: "t2",
            code: "TR02",
            statement: "Second space",
            canGenerateAngle: false,
            angles: [{ id: "a2", code: "AN02", statement: "Kept elsewhere" }],
          },
        ]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Buat ulang Angle" })).toBeNull();
    expect(screen.getByText("TR01")).toBeTruthy();
    expect(screen.getByText("TR02")).toBeTruthy();
    expect(screen.queryByText("AN01")).toBeNull();
    expect(screen.queryByText("AN02")).toBeNull();
    expect(screen.queryByRole("button", { name: "Generate Idea" })).toBeNull();
  });

  it("offers an Angle branch from one passing Territory", () => {
    const onGenerateAngle = vi.fn();
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT03"
        statement="A locked big thought"
        onGenerateAngle={onGenerateAngle}
        territories={[
          {
            id: "t1",
            code: "TR03",
            statement: "Pensiun dini",
            verdict: "AUDIT_PASS",
          },
        ]}
      />,
    );
    openActionMenu(/More actions TR03/);
    fireEvent.click(screen.getByRole("menuitem", { name: "Generate Angle" }));
    expect(onGenerateAngle).toHaveBeenCalledWith("t1");
  });

  it("shows the selected Territory and Generate Angle on its own inspector", () => {
    render(
      <LabNodeInspector
        kind="territory"
        code="TR01"
        statement="Kerangka Etika dan Nilai Organisasi"
        territoryId="t1"
        angleReady
        onGenerateAngle={vi.fn()}
        territoryArea={{
          lead: "Di area ini:",
          body: "di sini pertanyaan yang dijawab alasan itu muncul langsung di Kerangka Etika dan Nilai Organisasi.",
        }}
        territoryPass={{
          lead: "Lolos pemeriksaan.",
          body: "Kerangka Etika dan Nilai Organisasi menunjuk ruang konkret tempat alasan itu bisa dirasakan langsung, cukup luas untuk beberapa Angle.",
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Kerangka Etika dan Nilai Organisasi" })).toBeTruthy();
    expect(screen.getByText(/Di area ini:/)).toBeTruthy();
    expect(screen.getByText(/Lolos pemeriksaan\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buat ulang Angle" })).toBeNull();
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Buat ulang Angle" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate Territory" })).toBeNull();
  });

  it("keeps Audit hidden while Generate Angle is running and shows only Audit afterward", () => {
    const angles = [{ id: "a1", code: "AN01", statement: "One point of view", verdict: null }];
    const { rerender } = render(
      <LabNodeInspector
        kind="territory"
        code="TR01"
        statement="A locked territory"
        territoryId="t1"
        angleReady
        pendingAction="generate-angle"
        onGenerateAngle={vi.fn()}
        angles={angles}
        angleStage="audit"
        onAngleStage={vi.fn()}
      />,
    );
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Buat ulang Angle" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("button", { name: "Audit" })).toBeNull();
    rerender(
      <LabNodeInspector
        kind="territory"
        code="TR01"
        statement="A locked territory"
        territoryId="t1"
        angles={angles}
        angleStage="audit"
        onAngleStage={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Buat ulang Angle" })).toBeNull();
    expect(screen.getByRole("button", { name: "Audit" })).toBeTruthy();
  });

  it("shows a spinner on Audit and hides Generate Angle while audit is running", () => {
    render(
      <LabNodeInspector
        kind="territory"
        code="TR05"
        statement="A locked territory"
        territoryId="t1"
        angleReady
        pendingAction="audit"
        onGenerateAngle={vi.fn()}
        angles={[{ id: "a1", code: "AN01", statement: "One point of view", verdict: null }]}
        angleStage="audit"
        onAngleStage={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Buat ulang Angle" })).toBeNull();
    expect(screen.getByRole("button", { name: "Audit" }).getAttribute("aria-busy")).toBe("true");
  });

  it("does not offer a handwritten Angle, and shows Buat ulang Angle while generate runs", () => {
    const { rerender } = render(
      <LabNodeInspector
        kind="territory"
        code="TR01"
        statement="A locked territory"
        territoryId="t1"
        angleReady
        manualAdd={{ label: "Write an Angle", onSubmit: vi.fn(async () => null) }}
        onGenerateAngle={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Write an Angle")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Buat ulang Angle" })).toBeNull();
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Buat ulang Angle" })).toBeTruthy();
    rerender(
      <LabNodeInspector
        kind="territory"
        code="TR01"
        statement="A locked territory"
        territoryId="t1"
        angleReady
        pendingAction="generate-angle"
        onGenerateAngle={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "More actions" }).getAttribute("aria-busy")).toBe("true");
  });

  it("shows the selected Angle and Generate Idea on its own inspector", () => {
    render(
      <LabNodeInspector
        kind="angle"
        code="AN01"
        statement="Etika adalah pendorong perilaku."
        angleId="a1"
        ideaReady
        onGenerateIdea={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Etika adalah pendorong perilaku." })).toBeTruthy();
    expect(screen.getByText("Angle - AN01")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate Idea" })).toBeNull();
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Generate Idea" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buat ulang Angle" })).toBeNull();
  });

  it("puts Lock in the Angle menu", () => {
    const onLockIdeas = vi.fn();
    render(
      <LabNodeInspector
        kind="angle"
        code="AN01"
        statement="Akumulasi kekayaan dini seringkali"
        onLockIdeas={onLockIdeas}
      />,
    );
    openActionMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Lock" }));
    expect(onLockIdeas).toHaveBeenCalledOnce();
  });

  it("puts Lock in the Big Thought menu", () => {
    const onLockTerritories = vi.fn();
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT05"
        statement="Beban Finansial"
        onLockTerritories={onLockTerritories}
      />,
    );
    openActionMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Lock" }));
    expect(onLockTerritories).toHaveBeenCalledOnce();
  });

  it("keeps Write an Idea behind the Angle menu until it is chosen", () => {
    render(
      <LabNodeInspector
        kind="angle"
        code="AN01"
        statement="Bukan hanya tentang keuntungan"
        angleId="a1"
        ideaReady
        onGenerateIdea={vi.fn()}
        manualAdd={{ label: "Write an Idea", onSubmit: vi.fn(async () => null) }}
      />,
    );
    expect(screen.queryByText("Write an Idea")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    openActionMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Write an Idea" }));
    expect(screen.getByText("Write an Idea")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("puts a Fix button on each failed Idea card", () => {
    const onFixIdea = vi.fn();
    render(
      <LabNodeInspector
        kind="angle"
        code="AN01"
        statement="Waktu kerja bunga"
        ideas={[
          { id: "i2", code: "ID02", statement: "Mengundang pensiunan menjadi mentor", verdict: "AUDIT_FAIL" },
          { id: "i3", code: "ID03", statement: "Membangun kebun komunitas", verdict: "AUDIT_FAIL" },
          { id: "i4", code: "ID04", statement: "Mantan profesional menulis buku", verdict: "AUDIT_PASS" },
        ]}
        ideaStage="fix"
        onIdeaStage={vi.fn()}
        onFixIdea={onFixIdea}
      />,
    );
    expect(screen.getAllByRole("button", { name: /More actions ID0/ })).toHaveLength(2);
    openActionMenu(/More actions ID02/);
    fireEvent.click(screen.getByRole("menuitem", { name: "Fix" }));
    expect(onFixIdea).toHaveBeenCalledWith("ID02");
  });

  it("keeps the other Fix buttons clickable while one Idea fix is running", () => {
    const onFixIdea = vi.fn();
    render(
      <LabNodeInspector
        kind="angle"
        statement="Waktu kerja bunga"
        ideas={[
          { id: "i2", code: "ID02", statement: "Mengundang pensiunan menjadi mentor", verdict: "AUDIT_FAIL" },
          { id: "i5", code: "ID05", statement: "Mahasiswa menolak berinvestasi", verdict: "AUDIT_FAIL" },
        ]}
        ideaStage="fix"
        onFixIdea={onFixIdea}
        fixingIdeaCodes={["ID05"]}
        pendingAction="fix-idea:ID05"
      />,
    );
    const menus = screen.getAllByRole("button", { name: /More actions ID0/ });
    const running = menus.find((button) => button.getAttribute("aria-busy") === "true");
    const waiting = menus.find((button) => button.getAttribute("aria-busy") !== "true");
    expect(running).toBeTruthy();
    expect((running as HTMLButtonElement).disabled).toBe(true);
    expect((waiting as HTMLButtonElement).disabled).toBe(false);
    openActionMenu(/More actions ID02/);
    fireEvent.click(screen.getByRole("menuitem", { name: "Fix" }));
    expect(onFixIdea).toHaveBeenCalledWith("ID02");
  });

  it("keeps each idea note on its card until the arrow expands it", () => {
    render(
      <LabNodeInspector
        kind="angle"
        statement="Waktu kerja bunga"
        ideas={[
          { id: "i1", code: "ID01", statement: "Pengembangan keterampilan analisis" },
          { id: "i2", code: "ID02", statement: "Pemahaman pasar investasi dini" },
        ]}
        ideaNotes={[
          "ID01: Big Thought: kekuatan bunga majemuk memiliki lebih banyak waktu untuk bekerja.",
          "ID02: Big Thought: ide ini mengunci penjelasan lain.",
          "Fix already ran once. This set stays open until the ideas pass.",
        ]}
      />,
    );
    expect(screen.queryByText(/kekuatan bunga majemuk/)).toBeNull();
    expect(screen.queryByText(/mengunci penjelasan lain/)).toBeNull();
    expect(screen.getByText("Fix already ran once. This set stays open until the ideas pass.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Note ID01" }));
    expect(screen.getByText(/kekuatan bunga majemuk/)).toBeTruthy();
    expect(screen.queryByText(/mengunci penjelasan lain/)).toBeNull();
  });

  it("puts a Fix button on each failed Angle card", () => {
    const onFixAngle = vi.fn();
    render(
      <LabNodeInspector
        kind="territory"
        statement="Investasi jangka panjang"
        angles={[
          { id: "a1", code: "AN01", statement: "Pemula mencari hasil cepat", verdict: "AUDIT_FAIL" },
          { id: "a2", code: "AN02", statement: "Strategi sederhana terasa rumit", verdict: "AUDIT_PASS" },
          { id: "a3", code: "AN03", statement: "Pendekatan pasif tetap butuh intervensi", verdict: "AUDIT_FAIL" },
        ]}
        angleStage="fix"
        onAngleStage={vi.fn()}
        onFixAngle={onFixAngle}
      />,
    );
    expect(screen.getAllByRole("button", { name: /More actions AN0/ })).toHaveLength(2);
    openActionMenu(/More actions AN03/);
    fireEvent.click(screen.getByRole("menuitem", { name: "Fix" }));
    expect(onFixAngle).toHaveBeenCalledWith("AN03");
  });

  it("keeps the other Angle Fix buttons clickable while one fix is running", () => {
    const onFixAngle = vi.fn();
    render(
      <LabNodeInspector
        kind="territory"
        statement="Investasi jangka panjang"
        angles={[
          { id: "a1", code: "AN01", statement: "Pemula mencari hasil cepat", verdict: "AUDIT_FAIL" },
          { id: "a3", code: "AN03", statement: "Pendekatan pasif tetap butuh intervensi", verdict: "AUDIT_FAIL" },
        ]}
        angleStage="fix"
        onFixAngle={onFixAngle}
        fixingAngleCodes={["AN01"]}
        pendingAction="fix-angle:AN01"
      />,
    );
    const menus = screen.getAllByRole("button", { name: /More actions AN0/ });
    const running = menus.find((button) => button.getAttribute("aria-busy") === "true");
    const waiting = menus.find((button) => button.getAttribute("aria-busy") !== "true");
    expect(running).toBeTruthy();
    expect((running as HTMLButtonElement).disabled).toBe(true);
    expect((waiting as HTMLButtonElement).disabled).toBe(false);
    openActionMenu(/More actions AN03/);
    fireEvent.click(screen.getByRole("menuitem", { name: "Fix" }));
    expect(onFixAngle).toHaveBeenCalledWith("AN03");
  });

  it("keeps each angle explanation on its card until the arrow expands it", () => {
    render(
      <LabNodeInspector
        kind="territory"
        statement="Investasi jangka panjang"
        angles={[
          { id: "a1", code: "AN01", statement: "Pemula mencari hasil cepat", verdict: "AUDIT_FAIL" },
          { id: "a2", code: "AN02", statement: "Strategi sederhana terasa rumit", verdict: "AUDIT_PASS" },
          { id: "a3", code: "AN03", statement: "Pendekatan pasif tetap butuh intervensi", verdict: "AUDIT_FAIL" },
        ]}
        angleNotes={[
          "AN01 · AN03: Poin pandang tentang kesabaran mencakup pendekatan pasif.",
          "Fix already ran once. This set stays open until an audit passes.",
        ]}
      />,
    );
    expect(screen.queryByText(/pendekatan pasif/)).toBeNull();
    expect(screen.queryByText("Fix already ran once. This set stays open until an audit passes.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Note AN02" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Note AN01" }));
    expect(screen.getByText(/pendekatan pasif/)).toBeTruthy();
    expect(screen.getByText("Fix already ran once. This set stays open until an audit passes.")).toBeTruthy();
  });

  it("offers an Idea branch from one passing Angle", () => {
    const onGenerateIdea = vi.fn();
    render(
      <LabNodeInspector
        kind="territory"
        code="TR03"
        statement="Pensiun dini"
        onGenerateIdea={onGenerateIdea}
        angles={[{ id: "a1", code: "AN01", statement: "Waktu kerja bunga", verdict: "AUDIT_PASS" }]}
      />,
    );
    openActionMenu(/More actions AN01/);
    fireEvent.click(screen.getByRole("menuitem", { name: "Generate Idea" }));
    expect(onGenerateIdea).toHaveBeenCalledWith("a1");
  });

  it("offers Lock beside Generate Angle while a passing set is still open", () => {
    render(
      <LabNodeInspector
        kind="territory"
        code="TR01"
        statement="A locked territory"
        angles={[{ id: "a1", code: "AN01", statement: "One point of view", verdict: "AUDIT_PASS" }]}
        angleStage="generate"
        onAngleStage={vi.fn()}
        onLockAngles={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Buat ulang Angle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lock" })).toBeTruthy();
  });

  it("keeps the Master Thought definition behind an Indonesian info mark", () => {
    render(<LabNodeInspector kind="master" statement="Pandangan dunia utama." />);
    expect(screen.queryByText(/single biggest belief/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Definisi Master Thought" }));
    expect(screen.getByText(/kita ingin orang percaya bahwa ini benar/i)).toBeTruthy();
    expect(screen.getByText(/diuji sebagai penyebab di Idea/i)).toBeTruthy();
  });

  it("keeps the Angle definition behind an Indonesian info mark", () => {
    render(<LabNodeInspector kind="angle" code="AN01" statement="Satu sudut pandang." />);
    fireEvent.click(screen.getByRole("button", { name: "Definisi Angle" }));
    expect(screen.getByText(/pengamatan di dalam Territory/i)).toBeTruthy();
  });

  it("keeps the Idea definition behind an Indonesian info mark", () => {
    render(<LabNodeInspector kind="idea" code="ID01" statement="Satu konsep kreatif." />);
    fireEvent.click(screen.getByRole("button", { name: "Definisi Idea" }));
    expect(screen.getByText(/membuat Angle terjadi, terlihat, atau terbukti/i)).toBeTruthy();
  });

  it("keeps the Territory definition behind an Indonesian info mark", () => {
    render(<LabNodeInspector kind="territory" code="TR03" statement="Ruang pemberian sukarela." />);
    expect(screen.queryByText(/specific point of view/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Definisi Territory" }));
    expect(screen.getByText(/kata atau frasa benda, tanpa klaim/i)).toBeTruthy();
  });

  it("keeps Lock off while Challenger is the territory action", () => {
    render(
      <LabNodeInspector
        kind="territory"
        code="TR03"
        statement="A locked territory"
        angles={[{ id: "a1", code: "AN01", statement: "One point of view", verdict: "AUDIT_PASS" }]}
        angleStage="challenger"
        onAngleStage={vi.fn()}
        onLockAngles={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Challenger" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lock" })).toBeNull();
  });

  it("places delete on the open title and keeps it off child rows", () => {
    render(
      <LabNodeInspector
        kind="bigThought"
        code="BT02"
        statement="A locked big thought"
        onDelete={vi.fn()}
        territories={[
          { id: "t1", code: "TR01", statement: "First space" },
          { id: "t2", code: "TR02", statement: "Second space" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "More actions" }).getAttribute("aria-busy")).not.toBe("true");
    openActionMenu();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete Territory" })).toBeNull();
  });
});
