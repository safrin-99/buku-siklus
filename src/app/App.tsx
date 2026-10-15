import { Route, Routes } from 'react-router-dom';
import { FullScreen, StackLayout, TabLayout } from '../components/layout/Layouts';
import { Beranda } from '../pages/Beranda';
import { Catatan } from '../pages/Catatan';
import { CatatPembayaran } from '../pages/CatatPembayaran';
import { Detail } from '../pages/Detail';
import { Masuk } from '../pages/Masuk';
import { Pengaturan } from '../pages/Pengaturan';
import { PembayaranDetail } from '../pages/PembayaranDetail';
import { Placeholder } from '../pages/Placeholder';
import { RequireAuth } from './RequireAuth';

export function App() {
  return (
    <Routes>
      <Route
        path="masuk"
        element={
          <FullScreen>
            <Masuk />
          </FullScreen>
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<TabLayout />}>
          <Route index element={<Beranda />} />
          <Route path="catatan" element={<Catatan />} />
          <Route path="kotak-masuk" element={<Placeholder title="Kotak Masuk" />} />
          <Route path="kalender" element={<Placeholder title="Kalender" />} />
        </Route>
        <Route element={<StackLayout />}>
          <Route path="catatan/:debtId" element={<Detail />} />
          <Route path="catatan/:debtId/bayar" element={<CatatPembayaran />} />
          <Route path="catatan/:debtId/pembayaran/:paymentId" element={<PembayaranDetail />} />
          <Route path="tambah" element={<Placeholder title="Tambah catatan" back />} />
          <Route path="pengaturan" element={<Pengaturan />} />
          <Route path="*" element={<Placeholder title="Halaman tidak ditemukan" back />} />
        </Route>
      </Route>
    </Routes>
  );
}
