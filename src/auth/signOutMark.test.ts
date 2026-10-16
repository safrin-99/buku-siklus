import { afterEach, describe, expect, it, vi } from 'vitest';
import { signOutMark } from './signOutMark';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signOutMark', () => {
  it('menandai, membaca, dan menghapus hanya kuncinya sendiri', () => {
    const storage = memoryStorage();
    storage.setItem('sb-127-auth-token', 'tidak-disentuh');
    vi.stubGlobal('window', { sessionStorage: storage });

    expect(signOutMark.has()).toBe(false);
    signOutMark.set();
    expect(signOutMark.has()).toBe(true);
    signOutMark.clear();
    expect(signOutMark.has()).toBe(false);
    // Other keys (e.g. the Supabase session) are never touched.
    expect(storage.getItem('sb-127-auth-token')).toBe('tidak-disentuh');
    expect(storage.length).toBe(1);
  });

  it('penyimpanan diblokir (mode privat): tidak melempar, dianggap tidak ada tanda', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        return blocked();
      },
    });
    expect(() => signOutMark.set()).not.toThrow();
    expect(() => signOutMark.clear()).not.toThrow();
    expect(signOutMark.has()).toBe(false);
  });
});
