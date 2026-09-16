export interface LatLng {
  lat: number;
  lng: number;
}

export interface Country {
  /** ISO 3166-1 alpha-2 code, lowercase. Also used to derive the flag asset. */
  id: string;
  name: string;
  capital: string;
  region: string;
  /** Country centroid — used to center the map scope for the country-guess step. */
  center: LatLng;
  /** Capital city location — used to center the map scope for the capital-guess step. */
  capitalCoords: LatLng;
  /** Suggested zoom level (higher = more zoomed in) for the map scope placeholder. */
  mapZoom: number;
  /**
   * Rough settlement-count bucket. Countries in the 'few' bucket (under ~5 towns of
   * any size, e.g. Liechtenstein) are candidates for a multiple-choice capital
   * fallback instead of free text, per the small-country fallback note in
   * geo-game-instructions.md. Not yet wired into the round flow.
   */
  settlementCount: 'many' | 'few';
  /** True for island nations with no land borders (per world-countries' `borders` list). Used by the daily-quest generator to avoid overloading a day with hard-to-place islands. */
  isIsland: boolean;
  /** Island nations under ~2000 km² (Nauru, Tuvalu, Maldives, etc.) — a stricter sub-cap of isIsland in the daily-quest generator. */
  isVerySmallIsland: boolean;
}
