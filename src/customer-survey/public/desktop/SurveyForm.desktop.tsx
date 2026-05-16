import { SurveyFormBody, SurveyStaticPanel, SurveyThanksPanel, type SurveyFormBodyProps } from "@/features/customer-survey/public/SurveyFormBody";

type StaticVariant = "invalid" | "unavailable";

const STATIC_COPY: Record<StaticVariant, { title: string; body: string }> = {
  invalid: {
    title: "Tautan tidak valid",
    body: "Periksa kembali tautan survei dari WhatsApp.",
  },
  unavailable: {
    title: "Survei tidak tersedia",
    body: "Tautan mungkin sudah digunakan, kedaluwarsa, atau survei belum dikirim.",
  },
};

type Props =
  | { variant: StaticVariant }
  | ({ variant: "form" } & Omit<SurveyFormBodyProps, "density">)
  | { variant: "thanks"; message: string };

export function SurveyFormDesktop(props: Props) {
  let inner: React.ReactNode = null;
  switch (props.variant) {
    case "invalid":
    case "unavailable":
      inner = <SurveyStaticPanel {...STATIC_COPY[props.variant]} density="comfortable" />;
      break;
    case "thanks":
      inner = <SurveyThanksPanel message={props.message} density="comfortable" />;
      break;
    case "form": {
      const { variant, ...rest } = props;
      void variant;
      inner = <SurveyFormBody {...rest} density="comfortable" />;
      break;
    }
    default:
      break;
  }

  return <div className="hidden min-[1024px]:block">{inner}</div>;
}
