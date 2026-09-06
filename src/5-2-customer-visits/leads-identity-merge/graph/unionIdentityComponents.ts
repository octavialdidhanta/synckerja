import type { IdentityLeadKeys, IdentityNodeId } from "./buildIdentityKeyNodes";
import type { IdentityBridgeEdge } from "./buildIdentityBridgeEdges";

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // Stable: prefer lexicographically smaller root as component id.
    if (ra < rb) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
  }
}

export type IdentityComponent = {
  /** Stable component id = min node id in component. */
  componentId: string;
  leadIds: string[];
  phoneKeys: string[];
  emailKeys: string[];
};

/**
 * Union-find over identity nodes; map leads into components via their keys.
 */
export function unionIdentityComponents(
  leadKeys: IdentityLeadKeys[],
  bridges: IdentityBridgeEdge[],
): IdentityComponent[] {
  const uf = new UnionFind();
  const allNodes = new Set<IdentityNodeId>();

  for (const row of leadKeys) {
    if (row.phoneNode) allNodes.add(row.phoneNode);
    if (row.emailNode) allNodes.add(row.emailNode);
  }
  for (const n of allNodes) uf.find(n);
  for (const e of bridges) uf.union(e.a, e.b);

  // Also union nodes that appear on the same lead (redundant with bridge when both present)
  for (const row of leadKeys) {
    if (row.phoneNode && row.emailNode) uf.union(row.phoneNode, row.emailNode);
  }

  const byComponent = new Map<
    string,
    { leadIds: Set<string>; phoneKeys: Set<string>; emailKeys: Set<string> }
  >();

  for (const row of leadKeys) {
    const nodes = [row.phoneNode, row.emailNode].filter(Boolean) as IdentityNodeId[];
    if (nodes.length === 0) continue;
    const root = uf.find(nodes[0]!);
    for (const n of nodes.slice(1)) uf.union(root, n);
    const componentId = uf.find(nodes[0]!);

    let acc = byComponent.get(componentId);
    if (!acc) {
      acc = { leadIds: new Set(), phoneKeys: new Set(), emailKeys: new Set() };
      byComponent.set(componentId, acc);
    }
    acc.leadIds.add(row.leadId);
    if (row.phoneNode) acc.phoneKeys.add(row.phoneNode.slice("phone:".length));
    if (row.emailNode) acc.emailKeys.add(row.emailNode.slice("email:".length));
  }

  return [...byComponent.entries()]
    .map(([componentId, acc]) => ({
      componentId,
      leadIds: [...acc.leadIds].sort(),
      phoneKeys: [...acc.phoneKeys].sort(),
      emailKeys: [...acc.emailKeys].sort(),
    }))
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
}
