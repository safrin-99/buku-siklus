import { afterEach, describe, expect, it, vi } from 'vitest';
import { isUuid } from '../data/book';
import { newUuid } from './uuid';

afterEach(() => vi.unstubAllGlobals());

describe('newUuid', () => {
  it('menghasilkan UUID v4 yang valid dan unik', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newUuid()));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(isUuid(id)).toBe(true);
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19]);
    }
  });

  it('tanpa crypto.randomUUID (konteks tidak aman) tetap menghasilkan UUID v4 yang valid', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(typeof crypto.randomUUID).toBe('undefined');
    const id = newUuid();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('4');
    expect('89ab').toContain(id[19]);
  });
});
