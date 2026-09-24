import { describe, expect, it } from 'vitest';
import { countries } from '../../data/countries';
import { countryShapes } from '../../data/countryShapes.generated';

const byId = (id: string) => countries.find((c) => c.id === id)!;

describe('Vatican City', () => {
  it("has an outline that contains its capital pin, so the reveal square sits on the pin", () => {
    const [west, south, east, north] = countryShapes.va.bbox;
    const { lat, lng } = byId('va').capitalCoords;
    expect(lng).toBeGreaterThan(west);
    expect(lng).toBeLessThan(east);
    expect(lat).toBeGreaterThan(south);
    expect(lat).toBeLessThan(north);
  });

  it("is framed at Italy's zoom so the map shows Italy rather than a few city blocks", () => {
    expect(byId('va').mapZoom).toBe(byId('it').mapZoom);
  });
});
