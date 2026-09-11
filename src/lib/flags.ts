/**
 * Renders a country's flag from its ISO 3166-1 alpha-2 code using the Unicode
 * regional-indicator flag emoji, so no flag image assets need to be sourced or
 * shipped (and nothing is reused from other games' asset sets). Swap for a proper
 * image sprite later if emoji rendering proves inconsistent across target devices.
 */
export function flagEmoji(isoAlpha2: string): string {
  const codePoints = isoAlpha2
    .toUpperCase()
    .split('')
    .map((char) => 0x1f1e6 - 65 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
