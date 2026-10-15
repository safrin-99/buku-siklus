import { FullScreen } from '../components/layout/Layouts';

/** Shown when env is wrong. States the problem (never a key value) and how to fix it. */
export function ConfigError({ problems }: { problems: string[] }) {
  return (
    <FullScreen>
      <div className="px-4 pt-6">
        <div role="alert" className="rounded-card border border-border bg-surface p-6">
          <p className="text-money-md font-semibold">Konfigurasi belum lengkap.</p>
          <ul className="mt-3 list-disc pl-5 text-caption text-ink-2">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          <p className="mt-3 text-caption text-ink-2">
            Salin .env.example ke .env.local, isi nilainya, lalu jalankan ulang. Untuk mencoba tanpa backend: pnpm
            dev:fixture.
          </p>
        </div>
      </div>
    </FullScreen>
  );
}
