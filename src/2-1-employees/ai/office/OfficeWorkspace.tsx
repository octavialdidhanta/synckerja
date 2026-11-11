import { Link } from "react-router-dom";
import { SYNCKERJA_BRAND_LOGO_SRC } from "@/shared/brand/brandLogo";
import type { Employee } from "../../hooks/useEmployees";
import { appearanceFromId, BAY_CARPETS, type OfficeAppearance } from "./appearance";

export type OfficeBay = {
  id: string;
  name: string;
  employees: Employee[];
};

export function groupAiEmployeesByDepartment(employees: Employee[], unassignedLabel: string): OfficeBay[] {
  const groups = new Map<string, OfficeBay>();
  for (const employee of employees) {
    const name = employee.department_name?.trim() || unassignedLabel;
    const id = name.toLocaleLowerCase();
    const current = groups.get(id) ?? { id, name, employees: [] };
    current.employees.push(employee);
    groups.set(id, current);
  }
  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "id"));
}

function Hair({ appearance }: { appearance: OfficeAppearance }) {
  if (appearance.hairStyle === 1) {
    return <path d="M74 72c0-20 12-32 26-32s26 12 26 32c-8-14-16-18-26-18s-18 4-26 18z" fill={appearance.hair} />;
  }
  if (appearance.hairStyle === 2) {
    return (
      <>
        <circle cx="100" cy="38" r="8" fill={appearance.hair} />
        <path d="M76 70c2-18 12-28 24-28s22 10 24 28c-8-12-16-16-24-16s-16 4-24 16z" fill={appearance.hair} />
      </>
    );
  }
  if (appearance.hairStyle === 3) {
    return <path d="M78 72c2-22 16-34 30-30 10 4 14 14 8 24-12-8-22-10-32-4-4 2-6 6-6 10z" fill={appearance.hair} />;
  }
  return <path d="M76 72c2-20 14-32 28-30 10 2 16 12 14 24-10-12-20-16-30-12-6 2-10 8-12 18z" fill={appearance.hair} />;
}

function OfficeCharacter({ appearance }: { appearance: OfficeAppearance }) {
  return (
    <g className="ai-office-person">
      <path d="M58 118c8-16 76-16 84 0l-8 28H66z" fill="#3f4450" />
      <path d="M64 112c10-18 62-18 72 0v34H64z" fill={appearance.shirt} />
      <path d="M92 124h16l-2 14h-12z" fill="#fff" opacity="0.3" />
      <rect x="92" y="96" width="16" height="18" rx="5" fill={appearance.skin} />
      <circle cx="100" cy="74" r="24" fill={appearance.skin} />
      <Hair appearance={appearance} />
      <g className="ai-office-eye">
        <circle cx="92" cy="74" r="2.2" fill="#1c1917" />
        <circle cx="110" cy="74" r="2.2" fill="#1c1917" />
      </g>
      <path d="M94 84c4 3 10 3 14 0" fill="none" stroke="#9a3412" strokeWidth="1.4" strokeLinecap="round" />
      {appearance.glasses ? (
        <g fill="none" stroke="#1f2937" strokeWidth="1.5">
          <circle cx="92" cy="74" r="5" />
          <circle cx="110" cy="74" r="5" />
          <path d="M97 74h6" />
        </g>
      ) : null}
      <path d="M78 132c8 10 14 16 22 16s14-6 22-16" fill="none" stroke={appearance.skin} strokeWidth="7" strokeLinecap="round" />
    </g>
  );
}

function Workstation({
  employee,
  roleLabel,
  catalogLabel,
}: {
  employee: Employee;
  roleLabel: string;
  catalogLabel: string;
}) {
  const appearance = appearanceFromId(employee.id);
  return (
    <Link
      to={`/ai-employees/${employee.id}`}
      aria-label={`${employee.full_name}, ${roleLabel}, ${catalogLabel}`}
      title={`${employee.full_name} · ${roleLabel} · ${catalogLabel}`}
      className="group flex w-[220px] flex-col items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d4ed8]"
    >
      <svg viewBox="0 0 220 210" className="h-[210px] w-[220px] overflow-visible" aria-hidden>
        <ellipse cx="110" cy="196" rx="70" ry="7" fill="#000" opacity="0.08" />
        <OfficeCharacter appearance={appearance} />
        <path d="M28 146h164l-10 14H38z" fill="#c4885a" />
        <rect x="38" y="160" width="144" height="26" fill="#7a4b2c" />
        <rect x="46" y="186" width="8" height="14" fill="#5c3a22" />
        <rect x="166" y="186" width="8" height="14" fill="#5c3a22" />
        <rect x="56" y="100" width="108" height="52" rx="5" fill="#e7e7ec" />
        <clipPath id={`screen-${employee.id}`}>
          <rect x="59" y="103" width="102" height="46" rx="2" />
        </clipPath>
        <rect x="59" y="103" width="102" height="46" rx="2" fill="#f7f8fa" />
        <image
          href={SYNCKERJA_BRAND_LOGO_SRC}
          x="98"
          y="114"
          width="24"
          height="24"
          preserveAspectRatio="xMidYMid meet"
          clipPath={`url(#screen-${employee.id})`}
        />
        <rect x="106" y="152" width="8" height="6" rx="2" fill="#d4d4d8" />
        <rect x="88" y="157" width="44" height="4" rx="2" fill="#c8c8ce" />
        <clipPath id={`plate-${employee.id}`}>
          <rect x="62" y="166" width="96" height="14" />
        </clipPath>
        <rect x="60" y="166" width="100" height="16" rx="2" fill="#fffaf3" />
        <text
          x="110"
          y="177"
          textAnchor="middle"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          fill="#3f3428"
          clipPath={`url(#plate-${employee.id})`}
        >
          {employee.full_name}
        </text>
      </svg>
      <span className="mt-1 w-[168px] rounded-sm bg-[#fffaf3] px-2 py-1 text-center shadow-sm ring-1 ring-[#e4d5c0]">
        <span className="block truncate text-[11px] font-semibold leading-4 text-[#3f3428]">{roleLabel}</span>
        <span className="block truncate text-[10px] leading-4 text-[#6b5a45]">{catalogLabel}</span>
      </span>
    </Link>
  );
}

function Partition({ side }: { side: "left" | "right" }) {
  return (
    <div className={`pointer-events-none absolute inset-y-0 z-20 w-7 ${side === "left" ? "left-0" : "right-0"}`} aria-hidden>
      <div className="flex h-full flex-col justify-between border-x-4 border-[#b7a48c] bg-[#efe8dc] px-0.5 py-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-9 w-full rounded-[2px] bg-white/80 shadow-inner ring-1 ring-[#d9cbb8]" />
        ))}
      </div>
    </div>
  );
}

function DepartmentRoom({
  bay,
  carpet,
  noRoleLabel,
  catalogLabelFor,
}: {
  bay: OfficeBay;
  carpet: string;
  noRoleLabel: string;
  catalogLabelFor: (employeeId: string) => string;
}) {
  return (
    <section className="relative w-fit max-w-full overflow-hidden rounded-md shadow-[0_10px_24px_rgba(70,52,32,0.12)]" aria-label={bay.name}>
      <Partition side="left" />
      <Partition side="right" />
      <div className="border-b-4 border-[#cbbba4] bg-[#f7f1e8] px-8 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="rounded-sm bg-[#fffaf3] px-3 py-1 text-xs font-semibold tracking-wide text-[#5c4a32] shadow-sm ring-1 ring-[#e4d5c0]">
            {bay.name}
          </h2>
          <svg viewBox="0 0 36 36" className="h-8 w-8" aria-hidden>
            <rect x="16" y="24" width="4" height="10" fill="#8a6a45" />
            <ellipse cx="18" cy="16" rx="10" ry="8" fill="#3f8f4e" />
            <ellipse cx="12" cy="18" rx="6" ry="5" fill="#4caf60" />
            <ellipse cx="24" cy="18" rx="6" ry="5" fill="#2f7a3e" />
          </svg>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-12 w-28 rounded-[2px] border-4 border-[#e7e0d4] bg-gradient-to-b from-sky-200 to-sky-50 shadow-inner sm:w-36" />
          ))}
        </div>
      </div>
      <div className="relative px-8 py-4" style={{ backgroundColor: carpet }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: "linear-gradient(90deg, rgba(90,70,45,0.08) 1px, transparent 1px)",
            backgroundSize: "22px 100%",
          }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end gap-x-2 gap-y-4">
          {bay.employees.map((employee) => (
            <Workstation
              key={employee.id}
              employee={employee}
              roleLabel={employee.job_position_name?.trim() || noRoleLabel}
              catalogLabel={catalogLabelFor(employee.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function OfficeWorkspace({
  bays,
  noRoleLabel,
  catalogLabelFor,
}: {
  bays: OfficeBay[];
  noRoleLabel: string;
  catalogLabelFor: (employeeId: string) => string;
}) {
  return (
    <div
      className="relative min-h-[calc(100vh-150px)] flex-1 rounded-lg p-3 sm:p-4"
      style={{
        backgroundColor: "#d7cec0",
        backgroundImage: "linear-gradient(90deg, rgba(90,70,45,0.07) 1px, transparent 1px), linear-gradient(rgba(90,70,45,0.07) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <style>
        {`
          @keyframes ai-office-breathe {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-1.5px); }
          }
          @keyframes ai-office-blink {
            0%, 90%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.15); }
          }
          .ai-office-person { animation: ai-office-breathe 3.4s ease-in-out infinite; }
          .ai-office-eye { transform-box: fill-box; transform-origin: center; animation: ai-office-blink 4.6s infinite; }
          @media (prefers-reduced-motion: reduce) {
            .ai-office-person, .ai-office-eye { animation: none; }
          }
        `}
      </style>
      <div className="flex flex-col gap-4">
        {bays.map((bay, index) => (
          <DepartmentRoom
            key={bay.id}
            bay={bay}
            carpet={BAY_CARPETS[index % BAY_CARPETS.length] ?? BAY_CARPETS[0]}
            noRoleLabel={noRoleLabel}
            catalogLabelFor={catalogLabelFor}
          />
        ))}
      </div>
    </div>
  );
}
