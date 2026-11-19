/** Compare a spoken line with a brief cell. Audio tags and extra spaces do not change the key. */
export function narrationKey(value: string) {
  return value.replace(/\[[^\]\n]{0,80}\]/g, " ").replace(/\s+/g, " ").trim();
}
