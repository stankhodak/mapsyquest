import type { Country } from './types';

/**
 * Starter country set for foundation/testing purposes. Not the full ISO 3166 list —
 * see the "Country dropdown" open decision in geo-game-instructions.md for expanding
 * this to the full list. Includes a few microstates (Liechtenstein, San Marino,
 * Monaco, Vatican City) to exercise the small-country fallback path.
 */
export const countries: Country[] = [
  { id: 'us', name: 'United States', capital: 'Washington, D.C.', region: 'North America', center: { lat: 39.8, lng: -98.6 }, capitalCoords: { lat: 38.9, lng: -77.0 }, mapZoom: 3, settlementCount: 'many' },
  { id: 'ca', name: 'Canada', capital: 'Ottawa', region: 'North America', center: { lat: 56.1, lng: -106.3 }, capitalCoords: { lat: 45.4, lng: -75.7 }, mapZoom: 3, settlementCount: 'many' },
  { id: 'mx', name: 'Mexico', capital: 'Mexico City', region: 'North America', center: { lat: 23.6, lng: -102.5 }, capitalCoords: { lat: 19.4, lng: -99.1 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'br', name: 'Brazil', capital: 'Brasília', region: 'South America', center: { lat: -14.2, lng: -51.9 }, capitalCoords: { lat: -15.8, lng: -47.9 }, mapZoom: 3, settlementCount: 'many' },
  { id: 'ar', name: 'Argentina', capital: 'Buenos Aires', region: 'South America', center: { lat: -38.4, lng: -63.6 }, capitalCoords: { lat: -34.6, lng: -58.4 }, mapZoom: 4, settlementCount: 'many' },
  { id: 'gb', name: 'United Kingdom', capital: 'London', region: 'Europe', center: { lat: 55.4, lng: -3.4 }, capitalCoords: { lat: 51.5, lng: -0.1 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'fr', name: 'France', capital: 'Paris', region: 'Europe', center: { lat: 46.6, lng: 2.2 }, capitalCoords: { lat: 48.9, lng: 2.3 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'de', name: 'Germany', capital: 'Berlin', region: 'Europe', center: { lat: 51.2, lng: 10.4 }, capitalCoords: { lat: 52.5, lng: 13.4 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'es', name: 'Spain', capital: 'Madrid', region: 'Europe', center: { lat: 40.5, lng: -3.7 }, capitalCoords: { lat: 40.4, lng: -3.7 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'it', name: 'Italy', capital: 'Rome', region: 'Europe', center: { lat: 41.9, lng: 12.6 }, capitalCoords: { lat: 41.9, lng: 12.5 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'pt', name: 'Portugal', capital: 'Lisbon', region: 'Europe', center: { lat: 39.4, lng: -8.2 }, capitalCoords: { lat: 38.7, lng: -9.1 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'nl', name: 'Netherlands', capital: 'Amsterdam', region: 'Europe', center: { lat: 52.1, lng: 5.3 }, capitalCoords: { lat: 52.4, lng: 4.9 }, mapZoom: 6, settlementCount: 'many' },
  { id: 'ie', name: 'Ireland', capital: 'Dublin', region: 'Europe', center: { lat: 53.4, lng: -8.2 }, capitalCoords: { lat: 53.3, lng: -6.3 }, mapZoom: 6, settlementCount: 'many' },
  { id: 'ch', name: 'Switzerland', capital: 'Bern', region: 'Europe', center: { lat: 46.8, lng: 8.2 }, capitalCoords: { lat: 46.9, lng: 7.4 }, mapZoom: 6, settlementCount: 'many' },
  { id: 'se', name: 'Sweden', capital: 'Stockholm', region: 'Europe', center: { lat: 60.1, lng: 18.6 }, capitalCoords: { lat: 59.3, lng: 18.1 }, mapZoom: 4, settlementCount: 'many' },
  { id: 'no', name: 'Norway', capital: 'Oslo', region: 'Europe', center: { lat: 60.5, lng: 8.5 }, capitalCoords: { lat: 59.9, lng: 10.7 }, mapZoom: 4, settlementCount: 'many' },
  { id: 'pl', name: 'Poland', capital: 'Warsaw', region: 'Europe', center: { lat: 51.9, lng: 19.1 }, capitalCoords: { lat: 52.2, lng: 21.0 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'gr', name: 'Greece', capital: 'Athens', region: 'Europe', center: { lat: 39.1, lng: 21.8 }, capitalCoords: { lat: 38.0, lng: 23.7 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'tr', name: 'Turkey', capital: 'Ankara', region: 'Europe/Asia', center: { lat: 38.9, lng: 35.2 }, capitalCoords: { lat: 39.9, lng: 32.9 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'ru', name: 'Russia', capital: 'Moscow', region: 'Europe/Asia', center: { lat: 61.5, lng: 105.3 }, capitalCoords: { lat: 55.75, lng: 37.6 }, mapZoom: 2, settlementCount: 'many' },
  { id: 'eg', name: 'Egypt', capital: 'Cairo', region: 'Africa', center: { lat: 26.8, lng: 30.8 }, capitalCoords: { lat: 30.0, lng: 31.2 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'ng', name: 'Nigeria', capital: 'Abuja', region: 'Africa', center: { lat: 9.1, lng: 8.7 }, capitalCoords: { lat: 9.1, lng: 7.5 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'za', name: 'South Africa', capital: 'Pretoria', region: 'Africa', center: { lat: -30.6, lng: 22.9 }, capitalCoords: { lat: -25.7, lng: 28.2 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'ke', name: 'Kenya', capital: 'Nairobi', region: 'Africa', center: { lat: -0.02, lng: 37.9 }, capitalCoords: { lat: -1.3, lng: 36.8 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'ma', name: 'Morocco', capital: 'Rabat', region: 'Africa', center: { lat: 31.8, lng: -7.1 }, capitalCoords: { lat: 34.0, lng: -6.8 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'cn', name: 'China', capital: 'Beijing', region: 'Asia', center: { lat: 35.9, lng: 104.2 }, capitalCoords: { lat: 39.9, lng: 116.4 }, mapZoom: 3, settlementCount: 'many' },
  { id: 'jp', name: 'Japan', capital: 'Tokyo', region: 'Asia', center: { lat: 36.2, lng: 138.3 }, capitalCoords: { lat: 35.7, lng: 139.7 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'kr', name: 'South Korea', capital: 'Seoul', region: 'Asia', center: { lat: 35.9, lng: 127.8 }, capitalCoords: { lat: 37.6, lng: 127.0 }, mapZoom: 6, settlementCount: 'many' },
  { id: 'in', name: 'India', capital: 'New Delhi', region: 'Asia', center: { lat: 20.6, lng: 79.0 }, capitalCoords: { lat: 28.6, lng: 77.2 }, mapZoom: 4, settlementCount: 'many' },
  { id: 'th', name: 'Thailand', capital: 'Bangkok', region: 'Asia', center: { lat: 15.9, lng: 101.0 }, capitalCoords: { lat: 13.75, lng: 100.5 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'vn', name: 'Vietnam', capital: 'Hanoi', region: 'Asia', center: { lat: 14.1, lng: 108.3 }, capitalCoords: { lat: 21.0, lng: 105.8 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'id', name: 'Indonesia', capital: 'Jakarta', region: 'Asia', center: { lat: -0.8, lng: 113.9 }, capitalCoords: { lat: -6.2, lng: 106.8 }, mapZoom: 4, settlementCount: 'many' },
  { id: 'au', name: 'Australia', capital: 'Canberra', region: 'Oceania', center: { lat: -25.3, lng: 133.8 }, capitalCoords: { lat: -35.3, lng: 149.1 }, mapZoom: 3, settlementCount: 'many' },
  { id: 'nz', name: 'New Zealand', capital: 'Wellington', region: 'Oceania', center: { lat: -40.9, lng: 174.9 }, capitalCoords: { lat: -41.3, lng: 174.8 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'is', name: 'Iceland', capital: 'Reykjavik', region: 'Europe', center: { lat: 64.96, lng: -19.02 }, capitalCoords: { lat: 64.15, lng: -21.9 }, mapZoom: 5, settlementCount: 'many' },
  { id: 'li', name: 'Liechtenstein', capital: 'Vaduz', region: 'Europe', center: { lat: 47.166, lng: 9.555 }, capitalCoords: { lat: 47.14, lng: 9.52 }, mapZoom: 10, settlementCount: 'few' },
  { id: 'sm', name: 'San Marino', capital: 'San Marino', region: 'Europe', center: { lat: 43.94, lng: 12.46 }, capitalCoords: { lat: 43.94, lng: 12.45 }, mapZoom: 11, settlementCount: 'few' },
  { id: 'mc', name: 'Monaco', capital: 'Monaco', region: 'Europe', center: { lat: 43.75, lng: 7.41 }, capitalCoords: { lat: 43.75, lng: 7.42 }, mapZoom: 12, settlementCount: 'few' },
  { id: 'va', name: 'Vatican City', capital: 'Vatican City', region: 'Europe', center: { lat: 41.9, lng: 12.45 }, capitalCoords: { lat: 41.9, lng: 12.45 }, mapZoom: 13, settlementCount: 'few' },
  { id: 'mt', name: 'Malta', capital: 'Valletta', region: 'Europe', center: { lat: 35.94, lng: 14.38 }, capitalCoords: { lat: 35.9, lng: 14.51 }, mapZoom: 8, settlementCount: 'many' },
];

export function getCountryById(id: string): Country | undefined {
  return countries.find((c) => c.id === id);
}
