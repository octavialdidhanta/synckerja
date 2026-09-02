/** Guest-menu price, ESB-style: Rp15.000 */
export function formatOrderRp(value: number): string {
  return `Rp${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}
