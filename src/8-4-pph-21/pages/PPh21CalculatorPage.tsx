import { PPh21Calculator } from "../components/PPh21Calculator";
import { PPh21ModuleShell } from "../layout/PPh21ModuleShell";
import { PPH21_MAIN_GRID } from "../layout/pph21Layout";

const PPh21CalculatorPage = () => {
  return (
    <PPh21ModuleShell>
      <div className={PPH21_MAIN_GRID}>
        <div className="col-span-12 min-w-0 w-full">
          <PPh21Calculator />
        </div>
      </div>
    </PPh21ModuleShell>
  );
};

export default PPh21CalculatorPage;
