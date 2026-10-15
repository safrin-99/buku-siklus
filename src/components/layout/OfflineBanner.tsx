import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Strip di bawah header saat offline. Teks mengikuti kemampuan aplikasi saat ini (baca saja, belum ada antrean tulis);
 * ganti dengan teks DESIGN.md ("Perubahan akan dikirim saat tersambung") setelah antrean tulis offline ada.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="bg-status-due-bg px-4 py-2 text-caption font-semibold text-status-due-text">
      Offline. Data yang tampil mungkin sudah lama.
    </div>
  );
}
