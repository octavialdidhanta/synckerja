import { Checkbox } from "@/shared/components/ui/checkbox";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosPermissionNode } from "../../lib/posAccessPermissionCatalog";

type Props = {
  nodes: PosPermissionNode[];
  selected: Set<string>;
  onToggle: (key: string, checked: boolean, childKeys: string[]) => void;
  depth?: number;
};

function collectChildKeys(node: PosPermissionNode): string[] {
  const keys: string[] = [];
  const walk = (n: PosPermissionNode) => {
    keys.push(n.key);
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return keys;
}

export function PermissionCheckboxTree({ nodes, selected, onToggle, depth = 0 }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className={depth === 0 ? "divide-y" : ""}>
      {nodes.map((node) => {
        const childKeys = collectChildKeys(node);
        const checked = selected.has(node.key);
        const label = t(node.labelKey, node.labelFallback);
        const desc = node.descriptionKey
          ? t(node.descriptionKey, node.descriptionFallback ?? "")
          : null;

        return (
          <div key={node.key}>
            <label
              className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/40"
              style={{ paddingLeft: 12 + depth * 16 }}
            >
              <Checkbox
                className="mt-0.5"
                checked={checked}
                disabled={node.soon}
                onCheckedChange={(v) => onToggle(node.key, v === true, childKeys)}
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground">
                  {label}
                  {node.soon ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({t("employeesStaff.perm.soon", "soon")})
                    </span>
                  ) : null}
                </span>
                {desc ? (
                  <span className="mt-0.5 block text-xs italic text-muted-foreground">{desc}</span>
                ) : null}
              </span>
            </label>
            {node.children?.length ? (
              <PermissionCheckboxTree
                nodes={node.children}
                selected={selected}
                onToggle={onToggle}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** When parent toggled, also toggle all descendants; when child toggled, sync parent if all children on. */
export function applyPermissionToggle(
  selected: Set<string>,
  key: string,
  checked: boolean,
  childKeys: string[],
  parentKey?: string,
  siblingKeys?: string[],
): Set<string> {
  const next = new Set(selected);
  if (checked) {
    next.add(key);
    childKeys.forEach((k) => next.add(k));
  } else {
    next.delete(key);
    childKeys.forEach((k) => next.delete(k));
  }
  if (parentKey && siblingKeys) {
    const allSiblingsOn = siblingKeys.every((k) => next.has(k));
    if (allSiblingsOn) next.add(parentKey);
    else next.delete(parentKey);
  }
  return next;
}
