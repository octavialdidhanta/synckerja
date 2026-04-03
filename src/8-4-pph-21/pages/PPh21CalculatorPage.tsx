import { PPh21Calculator } from "../components/PPh21Calculator";
import { PPh21ModuleShell } from "../layout/PPh21ModuleShell";

const PPh21CalculatorPage = () => {
  return (
    <PPh21ModuleShell>
      <div className="col-span-12 flex min-h-0 flex-col">
        <PPh21Calculator />
      </div>
    </PPh21ModuleShell>
  );
};

export default PPh21CalculatorPage;
