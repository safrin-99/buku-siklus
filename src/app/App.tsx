import { Route, Routes } from "react-router-dom";
import { StackLayout, TabLayout } from "../components/layout/Layouts";
import { Beranda } from "../pages/Beranda";
import { Catatan } from "../pages/Catatan";
import { CatatPembayaran } from "../pages/CatatPembayaran";
import { Detail } from "../pages/Detail";
import { Email } from "../pages/Email";
import { Gajian } from "../pages/Gajian";
import { Kalender } from "../pages/Kalender";
import { KataSandi } from "../pages/KataSandi";
import { KotakMasuk } from "../pages/KotakMasuk";
import { Masuk } from "../pages/Masuk";
import { Pengaturan } from "../pages/Pengaturan";
import { PembayaranDetail } from "../pages/PembayaranDetail";
import { Placeholder } from "../pages/Placeholder";
import { TambahCatatan } from "../pages/TambahCatatan";
import { UbahCatatan } from "../pages/UbahCatatan";
import { RequireAuth } from "./RequireAuth";
import { ScrollManager } from "./ScrollManager";

export function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        {/* Masuk draws its own full-bleed layout (ink band + page). */}
        <Route path="masuk" element={<Masuk />} />
        <Route element={<RequireAuth />}>
          <Route element={<TabLayout />}>
            <Route index element={<Beranda />} />
            <Route path="catatan" element={<Catatan />} />
            <Route path="kotak-masuk" element={<KotakMasuk />} />
            <Route path="kalender" element={<Kalender />} />
          </Route>
          <Route element={<StackLayout />}>
            <Route path="catatan/:debtId" element={<Detail />} />
            <Route path="catatan/:debtId/bayar" element={<CatatPembayaran />} />
            <Route path="catatan/:debtId/ubah" element={<UbahCatatan />} />
            <Route
              path="catatan/:debtId/pembayaran/:paymentId"
              element={<PembayaranDetail />}
            />
            <Route path="tambah" element={<TambahCatatan />} />
            <Route path="pengaturan" element={<Pengaturan />} />
            <Route path="pengaturan/gajian" element={<Gajian />} />
            <Route path="pengaturan/kata-sandi" element={<KataSandi />} />
            <Route path="pengaturan/email" element={<Email />} />
            <Route
              path="*"
              element={<Placeholder title="Halaman tidak ditemukan" back />}
            />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
