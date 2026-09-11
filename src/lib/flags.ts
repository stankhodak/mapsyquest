/**
 * Flag SVGs are self-hosted static assets under public/flags/, copied at build
 * time by scripts/build-countries.mjs from the country-flag-icons package (a
 * devDependency — not shipped as a runtime library). Serving them ourselves
 * keeps flags original/self-contained rather than hot-linking a third-party CDN.
 */
export function flagImageUrl(isoAlpha2: string): string {
  return `/flags/${isoAlpha2.toLowerCase()}.svg`;
}
