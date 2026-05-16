import {
  SurveyStaticPanel,
  SurveyThanksPanel,
  type SurveyFormBodyProps,
} from "@/features/customer-survey/public/SurveyFormBody";
import { SurveyFormMobileForm } from "@/features/customer-survey/public/mobile/SurveyFormMobileForm";

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

export function SurveyFormMobile(props: Props) {
  let inner: React.ReactNode = null;
  switch (props.variant) {
    case "invalid":
    case "unavailable":
      inner = <SurveyStaticPanel {...STATIC_COPY[props.variant]} density="compact" />;
      break;
    case "thanks":
      inner = <SurveyThanksPanel message={props.message} density="compact" layout="fullscreen" />;
      break;
    case "form": {
      const { variant, ...rest } = props;
      void variant;
      inner = <SurveyFormMobileForm {...rest} />;
      break;
    }
    default:
      break;
  }

  return <div className="block min-[1024px]:hidden">{inner}</div>;
}
