import { cx } from '../../lib/cx';
import { formatRupiah } from '../../lib/money';

type Size = 'hero' | 'lg' | 'md' | 'sm' | 'caption';

// Ukuran dan bobot hanya dari sini; `className` hanya untuk warna/jarak (kelas ukuran yang bertabrakan tidak punya urutan pasti).
const sizeClass: Record<Size, string> = {
  hero: 'text-money-hero font-bold',
  lg: 'text-money-lg font-bold',
  md: 'text-money-md font-semibold',
  sm: 'text-caption font-semibold',
  caption: 'text-caption',
};

/** Semua nominal Rupiah lewat sini: format baku + angka tabular (Plus Jakarta Sans memakai angka proporsional secara bawaan). */
export function Money({ value, size = 'md', className }: { value: number; size?: Size; className?: string }) {
  return <span className={cx('tabular-nums', sizeClass[size], className)}>{formatRupiah(value)}</span>;
}
