import { Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';

/**
 * The routed screen. Keyed by path, so each new screen fades in once (DESIGN.md motion) and a rapid second tap simply
 * restarts it on the newest screen; a change of search parameters only (filters, calendar month) does not replay it.
 * Reduced motion: opacity only. The bottom navigation and offline banner sit outside and never animate or remount.
 */
function RoutedScreen() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="motion-safe:animate-page-in motion-reduce:animate-fade-in">
      <Outlet />
    </div>
  );
}

/** Layar tingkat atas: dengan navigasi bawah. Padding bawah memberi ruang agar FAB tidak menutupi baris terakhir. */
export function TabLayout() {
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-app pb-28">
        <OfflineBanner />
        <RoutedScreen />
      </div>
      <BottomNav />
    </>
  );
}

/** Layar turunan (detail, pengaturan, tambah): tanpa navigasi bawah. */
export function StackLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-app pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <OfflineBanner />
      <RoutedScreen />
    </div>
  );
}

/** Screens outside the main flow (sign in, session loading, config error): no navigation. */
export function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <OfflineBanner />
      {children}
    </div>
  );
}
