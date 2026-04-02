import LoanRequestForm from "@/9-request-form/components/LoanRequestForm";
import PurchaseRequestStatusPanel from "@/9-request-form/components/PurchaseRequestStatusPanel";

export const LoanContent = () => {
  return (
    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto md:flex-row [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="min-w-0 flex-[2_1_0%]">
        <LoanRequestForm />
      </div>
      <div className="flex min-h-0 min-w-0 w-full flex-[1_1_0%] flex-col border-t border-border bg-card md:border-l md:border-t-0">
        <PurchaseRequestStatusPanel />
      </div>
    </div>
  );
};

LoanContent.displayName = "LoanContent";
