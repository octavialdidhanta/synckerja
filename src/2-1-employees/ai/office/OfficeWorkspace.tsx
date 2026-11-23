import { Link } from "react-router-dom";
import { SYNCKERJA_BRAND_LOGO_SRC } from "@/shared/brand/brandLogo";
import type { Employee } from "../../hooks/useEmployees";
import { appearanceFromId, type OfficeAppearance } from "./appearance";
import type { OfficeBay } from "./groupAiEmployeesByDepartment";

const WHITE_GRID = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(90deg, rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(rgba(0,0,0,0.12) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
} as const;

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
    <g>
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

const BOOK_COLORS = ["#c45c4a", "#3d6f8f", "#b8893d", "#5a7a4a"] as const;

/** Stack rests on the hairline (head cx=100, top ~y 50). Keep SVG transform only — CSS transform overrides it. */
function JobDescBooks({ labels }: { labels: string[] }) {
  const books = labels.slice(0, 3);
  if (books.length === 0) return null;
  const bookH = 16;
  const bookThickness = 14;
  const hairTop = 50;
  const topY = hairTop - books.length * bookH - 1;
  return (
    <g transform={`translate(100 ${topY})`}>
      {books.map((label, index) => {
        const y = index * bookH;
        const tilt = index % 2 === 0 ? -5 : 4;
        const width = 78 - index * 4;
        const fill = BOOK_COLORS[index % BOOK_COLORS.length];
        const short = label.length > 18 ? `${label.slice(0, 17)}…` : label;
        return (
          <g key={`${label}-${index}`} transform={`rotate(${tilt} 0 ${y + bookThickness / 2})`}>
            <rect x={-width / 2} y={y} width={width} height={bookThickness} rx="2" fill={fill} />
            <rect x={-width / 2} y={y} width="5" height={bookThickness} rx="1.5" fill="#fff" opacity="0.3" />
            <text
              x="0"
              y={y + bookThickness * 0.72}
              textAnchor="middle"
              fontSize="7.5"
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
              fill="#fffaf3"
            >
              {short}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Workstation({
  employee,
  roleLabel,
  jobDescLine,
  jobDescBooks,
  catalogLabel,
}: {
  employee: Employee;
  roleLabel: string;
  jobDescLine: string;
  jobDescBooks: string[];
  catalogLabel: string;
}) {
  const appearance = appearanceFromId(employee.id);
  const detail = [roleLabel, jobDescLine, catalogLabel].filter(Boolean).join(" · ");
  return (
    <Link
      to={`/ai-employees/${employee.id}`}
      aria-label={`${employee.full_name}, ${detail}`}
      title={`${employee.full_name} · ${detail}`}
      className="group flex w-[220px] flex-col items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d4ed8]"
    >
      <svg viewBox="0 0 220 230" className="h-[230px] w-[220px] overflow-visible" aria-hidden>
        <ellipse cx="110" cy="216" rx="70" ry="7" fill="#000" opacity="0.08" />
        <g transform="translate(0 20)">
          <g className="ai-office-person">
            <OfficeCharacter appearance={appearance} />
            <JobDescBooks labels={jobDescBooks} />
          </g>
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
        </g>
      </svg>
      <span className="mt-1 w-[168px] rounded-sm bg-[#fffaf3] px-2 py-1 text-center shadow-sm ring-1 ring-[#e4d5c0]">
        <span className="block truncate text-[11px] font-semibold leading-4 text-[#3f3428]">{roleLabel}</span>
        {jobDescLine ? (
          <span className="block truncate text-[10px] leading-4 text-[#5c4a32]">{jobDescLine}</span>
        ) : null}
        <span className="block truncate text-[10px] leading-4 text-[#6b5a45]">{catalogLabel}</span>
      </span>
    </Link>
  );
}

function Partition({ side }: { side: "left" | "right" }) {
  return (
    <div className={`pointer-events-none absolute inset-y-0 z-20 w-7 ${side === "left" ? "left-0" : "right-0"}`} aria-hidden>
      <div className="flex h-full flex-col justify-between border-x-4 border-gray-300 bg-gray-100 px-0.5 py-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-9 w-full rounded-[2px] bg-white shadow-inner ring-1 ring-black/10" />
        ))}
      </div>
    </div>
  );
}

function DepartmentRoom({
  bay,
  noRoleLabel,
  jobDescFor,
  catalogLabelFor,
}: {
  bay: OfficeBay;
  noRoleLabel: string;
  jobDescFor: (employeeId: string) => { line: string; books: string[] };
  catalogLabelFor: (employeeId: string) => string;
}) {
  return (
    <section
      className="relative flex h-full min-h-0 w-fit max-w-full flex-col self-stretch overflow-hidden rounded-md shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-black/10"
      aria-label={bay.name}
      style={WHITE_GRID}
    >
      <Partition side="left" />
      <Partition side="right" />
      <div className="relative z-10 flex-shrink-0 border-b border-black/10 bg-white/90 px-8 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="rounded-sm bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gray-700 shadow-sm ring-1 ring-black/10">
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
            <div key={index} className="h-12 w-28 rounded-[2px] border-4 border-gray-200 bg-gradient-to-b from-sky-200 to-sky-50 shadow-inner sm:w-36" />
          ))}
        </div>
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-8 py-4">
        <div className="relative flex flex-wrap content-start items-end gap-x-2 gap-y-4">
          {bay.employees.map((employee) => {
            const jobDesc = jobDescFor(employee.id);
            return (
              <Workstation
                key={employee.id}
                employee={employee}
                roleLabel={employee.job_position_name?.trim() || noRoleLabel}
                jobDescLine={jobDesc.line}
                jobDescBooks={jobDesc.books}
                catalogLabel={catalogLabelFor(employee.id)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function OfficeWorkspace({
  bays,
  noRoleLabel,
  jobDescFor,
  catalogLabelFor,
}: {
  bays: OfficeBay[];
  noRoleLabel: string;
  jobDescFor: (employeeId: string) => { line: string; books: string[] };
  catalogLabelFor: (employeeId: string) => string;
}) {
  return (
    <div
      className="relative flex h-full min-h-[calc(100vh-150px)] flex-1 flex-col self-stretch overflow-hidden rounded-lg p-3 sm:p-4"
      style={WHITE_GRID}
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
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 items-stretch gap-4">
        {bays.map((bay) => (
          <DepartmentRoom
            key={bay.id}
            bay={bay}
            noRoleLabel={noRoleLabel}
            jobDescFor={jobDescFor}
            catalogLabelFor={catalogLabelFor}
          />
        ))}
      </div>
    </div>
  );
}
