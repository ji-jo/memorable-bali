import { describe, expect, it } from 'vitest';

import { shortStayLabel } from './stay-location';

describe('shortStayLabel', () => {
  it('keeps short labels unchanged', () => {
    expect(shortStayLabel('Ubud')).toBe('Ubud');
    expect(shortStayLabel('My stay')).toBe('My stay');
  });

  it('uses only the first place name from a geocode string', () => {
    expect(shortStayLabel('Kusamba, Dawan, Klungkung Regency')).toBe('Kusamba');
    expect(shortStayLabel(' Seminyak , Badung ')).toBe('Seminyak');
  });

  it('trims whitespace', () => {
    expect(shortStayLabel('  Ubud  ')).toBe('Ubud');
  });
});
