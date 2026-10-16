// Remembers, for this tab only, that the user signed out on purpose. After that, an old history entry (Back after
// Keluar, or the reload after "Keluar dari semua perangkat") must not become the destination of the next sign in.
// Only this one key is touched; nothing sensitive is stored. Storage can be blocked (private mode, site data off):
// every access is guarded, and the in-memory flag in AuthProvider still covers the current page.
const KEY = 'buku-siklus:signed-out-by-user';

export const signOutMark = {
  set(): void {
    try {
      window.sessionStorage.setItem(KEY, '1');
    } catch {
      // Storage unavailable: only the in-memory flag applies.
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      // Storage unavailable: nothing was stored.
    }
  },
  has(): boolean {
    try {
      return window.sessionStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  },
};
