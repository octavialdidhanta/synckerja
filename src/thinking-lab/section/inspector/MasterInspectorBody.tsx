import { MasterCatalogField } from "@/thinking-lab/section/MasterCatalogField";
import type { LabCatalog, MasterCatalogLink } from "@/thinking-lab/master-thought/catalog";

export type MasterInspectorBodyProps = {
  catalog: MasterCatalogLink;
  catalogs: LabCatalog[];
  catalogPending: boolean;
  onSaveCatalog: (catalog: MasterCatalogLink) => void;
};

export function MasterInspectorBody({ catalog, catalogs, catalogPending, onSaveCatalog }: MasterInspectorBodyProps) {
  return (
    <MasterCatalogField value={catalog} catalogs={catalogs} pending={catalogPending} onSave={onSaveCatalog} />
  );
}