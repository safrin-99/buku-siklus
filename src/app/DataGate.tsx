import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { FullScreen } from '../components/layout/Layouts';
import { SessionLoading } from '../components/layout/SessionLoading';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/States';
import { DataSourceProvider } from '../data/context';
import { openDataSource } from '../data/open';

/** Opens the data source (and picks the book) once per user, then provides it to every screen below. */
export function DataGate({ userId, children }: { userId: string; children: ReactNode }) {
  const { signOut } = useAuth();
  const query = useQuery({
    queryKey: ['data-source', userId],
    queryFn: openDataSource,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (query.isPending) return <SessionLoading />;

  if (query.isError) {
    return (
      <FullScreen>
        <div className="px-4 pt-6">
          <ErrorState
            title="Data tidak bisa dimuat."
            hint="Periksa koneksi, lalu coba lagi."
            onRetry={() => void query.refetch()}
          />
        </div>
      </FullScreen>
    );
  }

  if (query.data === null) {
    return (
      <FullScreen>
        <div className="px-4 pt-6">
          <EmptyState
            title="Akun ini belum punya buku."
            action={
              <div className="flex flex-col gap-3">
                <p className="text-caption text-ink-2">
                  Buat buku pertama lewat SQL Editor Supabase (supabase/scripts/first-book.sql), lalu muat ulang.
                </p>
                <Button variant="primary" onClick={() => void query.refetch()}>
                  Muat ulang
                </Button>
                <Button variant="secondary" onClick={() => void signOut('local').catch(() => undefined)}>
                  Keluar
                </Button>
              </div>
            }
          />
        </div>
      </FullScreen>
    );
  }

  return <DataSourceProvider source={query.data}>{children}</DataSourceProvider>;
}
