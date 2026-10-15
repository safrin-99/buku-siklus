import { ArrowLeft, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  settings?: boolean;
}

const iconButton = 'grid size-12 shrink-0 place-items-center rounded-chip text-ink active:bg-surface-inset';

/** Judul layar di kiri, aksi di kanan. Tanpa avatar. Pengaturan lewat ikon gerigi (bukan tab). */
export function ScreenHeader({ title, subtitle, back = false, settings = true }: Props) {
  const navigate = useNavigate();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/catatan');
  };

  return (
    <header className="sticky top-0 z-10 bg-canvas px-4 pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-14 items-center gap-1">
        {back ? (
          <button type="button" onClick={goBack} aria-label="Kembali" className={`${iconButton} -ml-3`}>
            <ArrowLeft aria-hidden size={24} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 py-2">
          <h1 className="text-title font-bold">{title}</h1>
          {subtitle ? <p className="text-caption text-ink-2">{subtitle}</p> : null}
        </div>
        {settings ? (
          <Link to="/pengaturan" aria-label="Pengaturan" className={`${iconButton} -mr-3`}>
            <Settings aria-hidden size={24} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
