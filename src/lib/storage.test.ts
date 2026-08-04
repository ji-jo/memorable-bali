import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStorage, writeStorage, removeStorage, STORAGE_VERSION } from './storage';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a value', () => {
    writeStorage('thing', { a: 1 });
    expect(readStorage('thing', null)).toEqual({ a: 1 });
  });

  it('namespaces every key', () => {
    writeStorage('visited', ['a']);
    expect(localStorage.getItem('bali-explorer:visited')).not.toBeNull();
    expect(localStorage.getItem('visited')).toBeNull();
  });

  it('falls back when the key is absent', () => {
    expect(readStorage('missing', 'default')).toBe('default');
  });

  /** A stale record from an earlier build must not reach the app. */
  it('discards a record written under a different version', () => {
    localStorage.setItem(
      'bali-explorer:old',
      JSON.stringify({ __v: STORAGE_VERSION + 1, data: 'stale' }),
    );
    expect(readStorage('old', 'fallback')).toBe('fallback');
  });

  it('falls back on corrupt JSON rather than throwing', () => {
    localStorage.setItem('bali-explorer:broken', '{not json');
    expect(() => readStorage('broken', 'fallback')).not.toThrow();
    expect(readStorage('broken', 'fallback')).toBe('fallback');
  });

  it('falls back when the envelope has no version', () => {
    localStorage.setItem('bali-explorer:bare', JSON.stringify({ data: 'x' }));
    expect(readStorage('bare', 'fallback')).toBe('fallback');
  });

  /** Safari private mode and quota-exceeded both throw on setItem. */
  it('does not throw when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeStorage('x', 1)).not.toThrow();
    spy.mockRestore();
  });

  it('removes a key', () => {
    writeStorage('temp', 1);
    removeStorage('temp');
    expect(readStorage('temp', 'gone')).toBe('gone');
  });
});
