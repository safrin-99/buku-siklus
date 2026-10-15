import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';

/** Layar tingkat atas: dengan navigasi bawah. Padding bawah memberi ruang agar FAB tidak menutupi baris terakhir. */
export function TabLayout() {
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-app pb-28">
        <OfflineBanner />
        <Outlet />
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
      <Outlet />
    </div>
  );
}
