import raw from './fixtures.generated.json';
import { fixtureSchema, type CycleSummary } from './schemas';
import { PaymentWriteError } from './paymentErrors';
import { NotFoundError, type DataSource } from './source';

// Divalidasi saat dimuat: bila skema SQL berubah dan fixture belum dibangkitkan ulang, gagal keras di sini.
const fixture = fixtureSchema.parse(raw);

/**
 * Mode simulasi untuk memeriksa state layar tanpa backend: tambahkan `?fixture=` pada URL.
 *   loading → tidak pernah selesai   slow → tertunda 1,2 dtk   error → ditolak   empty → daftar kosong
 */
type Mode = 'normal' | 'loading' | 'slow' | 'error' | 'empty';

function currentMode(): Mode {
  if (typeof window === 'undefined') return 'normal';
  const value = new URLSearchParams(window.location.search).get('fixture');
  return value === 'loading' || value === 'slow' || value === 'error' || value === 'empty' ? value : 'normal';
}

async function gate<T>(produce: (mode: Mode) => T): Promise<T> {
  const mode = currentMode();
  if (mode === 'loading') return new Promise<T>(() => undefined);
  if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 1200));
  if (mode === 'error') throw new Error('Simulasi galat (?fixture=error)');
  return produce(mode);
}

/** Buku tanpa catatan: semua angka turunan nol, supaya state kosong tidak kontradiktif dengan daftar. */
function emptyCycle(cycle: CycleSummary): CycleSummary {
  return {
    ...cycle,
    obligations_idr: 0,
    paid_idr: 0,
    unpaid_idr: 0,
    free_idr: cycle.base_salary_idr,
    carryover_overdue_idr: 0,
    total_owe_remaining_idr: 0,
    total_owed_remaining_idr: 0,
    overdue_count: 0,
  };
}

export function createFixtureSource(): DataSource {
  return {
    kind: 'fixture',
    bookId: fixture.book.id,
    getToday: () => fixture.today,
    cycleSummary: () => gate((mode) => (mode === 'empty' ? emptyCycle(fixture.cycle) : fixture.cycle)),
    debts: () => gate((mode) => (mode === 'empty' ? [] : fixture.debts)),
    inboxPendingCount: () => gate((mode) => (mode === 'empty' ? 0 : fixture.inbox_pending)),
    // Sample data is read-only: the delay lets the "saving" state be inspected, then the write is refused.
    recordPayment: () => new Promise((_resolve, reject) => setTimeout(() => reject(new PaymentWriteError('readonly')), 1200)),
    reversePayment: () => new Promise((_resolve, reject) => setTimeout(() => reject(new PaymentWriteError('readonly')), 1200)),
    debtDetail: (debtId) =>
      gate(() => {
        const debt = fixture.debts.find((d) => d.debt_id === debtId);
        if (!debt) throw new NotFoundError(`catatan ${debtId}`);
        const meta = fixture.meta.find((m) => m.debt_id === debtId);
        return {
          debt,
          memo: meta?.memo ?? null,
          category: meta?.category ?? null,
          payments: fixture.payments.filter((p) => p.debt_id === debtId),
          installments: fixture.installments.filter((i) => i.debt_id === debtId),
        };
      }),
  };
}
