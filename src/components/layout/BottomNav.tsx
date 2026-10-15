import { BookOpen, CalendarDays, House, Inbox, Plus, type LucideIcon } from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { useInboxCount } from '../../data/hooks';
import { cx } from '../../lib/cx';

interface Item {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

function NavItem({ to, label, Icon, end, badge }: Item) {
  const accessibleName = badge ? `Kotak Masuk, ${badge} menunggu konfirmasi` : undefined;
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={accessibleName}
      className={({ isActive }) =>
        cx(
          'flex min-h-16 flex-col items-center justify-center gap-0.5 text-label',
          isActive ? 'font-bold text-ink' : 'font-semibold text-ink-2',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon aria-hidden size={24} strokeWidth={isActive ? 2.5 : 2} />
            {badge ? (
              <span
                aria-hidden
                className="absolute -top-2 -right-3 grid h-5 min-w-5 place-items-center rounded-chip bg-primary px-1 text-label font-bold text-on-ink"
              >
                {badge}
              </span>
            ) : null}
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

/** 5 slot: Beranda, Catatan, [+], Kotak, Kalender. Pengaturan lewat gerigi di header. */
export function BottomNav() {
  const inbox = useInboxCount();
  return (
    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-app grid-cols-5 items-center">
        <NavItem to="/" label="Beranda" Icon={House} end />
        <NavItem to="/catatan" label="Catatan" Icon={BookOpen} />
        <Link
          to="/tambah"
          aria-label="Tambah catatan"
          className="-mt-6 mx-auto grid size-14 place-items-center rounded-chip bg-primary text-on-ink shadow-fab active:bg-primary-pressed"
        >
          <Plus aria-hidden size={28} />
        </Link>
        <NavItem to="/kotak-masuk" label="Kotak" Icon={Inbox} badge={inbox.data ?? 0} />
        <NavItem to="/kalender" label="Kalender" Icon={CalendarDays} />
      </div>
    </nav>
  );
}
