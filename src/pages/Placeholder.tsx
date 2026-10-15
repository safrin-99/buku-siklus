import { Link } from 'react-router-dom';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { EmptyState } from '../components/ui/States';

/** Layar yang sudah ada di navigasi tetapi belum dibangun. Jujur soal itu, tanpa tombol yang tidak berfungsi. */
export function Placeholder({ title, back = false }: { title: string; back?: boolean }) {
  return (
    <>
      <ScreenHeader title={title} back={back} settings={title !== 'Pengaturan'} />
      <div className="px-4">
        <EmptyState
          title="Layar ini belum dibangun."
          action={
            <Link to="/" className="inline-flex min-h-12 items-center px-4 text-body font-semibold underline">
              Kembali ke Beranda
            </Link>
          }
        />
      </div>
    </>
  );
}
