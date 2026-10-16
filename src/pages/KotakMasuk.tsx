import { Link } from 'react-router-dom';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { useInboxCount } from '../data/hooks';

/**
 * Kotak Masuk is where captured bank/e-wallet notifications wait for confirmation (DESIGN.md section 7.5). The capture
 * side (MacroDroid + Edge Function ingest-notification) and the confirmation screen are not built yet, so this screen
 * says exactly that instead of pretending, and points to the manual way in.
 */
export function KotakMasuk() {
  const inbox = useInboxCount();
  const waiting = inbox.data;
  return (
    <>
      {/* The count is shown only once known, so it always agrees with the navigation badge (DESIGN.md section 11.3). */}
      <ScreenHeader title="Kotak Masuk" subtitle={waiting === undefined ? undefined : `${waiting} menunggu konfirmasi`} />
      <div className="flex flex-col gap-4 px-4 pb-6">
        <EmptyState
          title={
            inbox.isError
              ? 'Jumlah notifikasi tidak bisa dimuat.'
              : waiting
                ? `${waiting} notifikasi menunggu, tetapi layar konfirmasinya belum dibangun.`
                : 'Belum ada notifikasi yang masuk.'
          }
          action={
            <Link to="/tambah" className="inline-flex min-h-12 items-center px-4 text-body font-semibold underline">
              Tambah catatan manual
            </Link>
          }
        />
        <p className="text-caption text-ink-2">
          Kotak Masuk akan menampung notifikasi bank dan e-wallet dari HP-mu untuk kamu konfirmasi sebelum masuk buku.
          Penangkap notifikasinya belum dipasang. Sampai saat itu, catat pembayaran dan catatan baru secara manual.
        </p>
      </div>
    </>
  );
}
