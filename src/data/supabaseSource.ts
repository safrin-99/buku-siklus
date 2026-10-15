import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { todayInZone } from '../lib/dates';
import { bookSchema, isUuid, pickActiveBook, type Book } from './book';
import { mapInstallmentRow } from './mappers';
import { bookSettingsRowSchema, cycleSummarySchema, debtMetaSchema, debtRowSchema, paymentRowSchema } from './schemas';
import { PaymentWriteError } from './paymentErrors';
import { SettingsWriteError } from './settingsErrors';
import { settleWrite } from './settle';
import { NotFoundError, type DataSource, type DebtDetail } from './source';

/**
 * Column lists shared by the source and by the contract test (src/data/supabaseShapes.test.ts), so the test runs
 * exactly the selects the app sends. Dates are returned by PostgREST as 'YYYY-MM-DD' strings and bigint as numbers.
 */
export const COLUMNS = {
  book: 'id, name, timezone, payday_day, base_salary_idr, archived_at, created_at',
  meta: 'id, memo, category, description',
  payment: 'id, debt_id, paid_on, amount_idr, reference, reverses_payment_id, proof_path, note',
  installment: 'installment_id, debt_id, seq, due_date, amount_idr, is_paid, due_remaining_idr',
  bookSettings: 'id, name, payday_day, base_salary_idr',
} as const;

/** Deliberately generic: server messages are not shown or logged (they can name tables and constraints). */
export class DataError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Permintaan data gagal (${code})`);
    this.name = 'DataError';
    this.code = code;
  }
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new DataError(result.error.code || 'unknown');
  if (result.data === null) throw new DataError('empty');
  return result.data;
}

/** The oldest non-archived book of the signed-in user, or null when the account has no book. */
export async function loadActiveBook(client: SupabaseClient): Promise<Book | null> {
  const rows = unwrap(await client.from('books').select(COLUMNS.book).is('archived_at', null));
  return pickActiveBook(z.array(bookSchema).parse(rows));
}

export function createSupabaseSource(client: SupabaseClient, book: Book): DataSource {
  const bookId = book.id;
  // Fail loudly at creation if the book's time zone is not a valid IANA name (the SQL functions would fail too).
  todayInZone(book.timezone);

  // Appends one ledger row. Success is decided by looking the id up, not by the error alone (see settleWrite).
  const appendToLedger = async (row: { id: string } & Record<string, unknown>): Promise<void> => {
    const outcome = await settleWrite<PostgrestError>(
      async () => (await client.from('payments').insert({ ...row, book_id: bookId })).error,
      async () => {
        const { data, error } = await client.from('payments').select('id').eq('id', row.id).maybeSingle();
        if (error) throw error;
        return data !== null;
      },
      // PostgREST/Postgres errors carry a code; a transport failure has an empty one.
      (error) => !error.code,
    );
    if (outcome !== 'saved') throw new PaymentWriteError(outcome);
  };

  // No p_today: SQL uses "today" in the book's time zone.
  const debtList = async (): Promise<unknown> => unwrap(await client.rpc('debt_list', { p_book: bookId }));

  return {
    kind: 'supabase',
    bookId,
    getToday: () => todayInZone(book.timezone),

    async cycleSummary() {
      const rows = z.array(cycleSummarySchema).parse(
        unwrap(await client.rpc('cycle_summary', { p_book: bookId })),
      );
      const [summary] = rows;
      if (!summary) throw new NotFoundError('buku');
      return summary;
    },

    async debts() {
      return z.array(debtRowSchema).parse(await debtList());
    },

    async debtDetail(debtId): Promise<DebtDetail> {
      if (!isUuid(debtId)) throw new NotFoundError(`catatan ${debtId}`);
      const [debtRes, metaRes, paymentRes, installmentRes] = await Promise.all([
        client.rpc('debt_list', { p_book: bookId }).eq('debt_id', debtId),
        client.from('debts').select(COLUMNS.meta).eq('book_id', bookId).eq('id', debtId).maybeSingle(),
        // Order matters: labelPayments() reads the array chronologically.
        client
          .from('payments')
          .select(COLUMNS.payment)
          .eq('book_id', bookId)
          .eq('debt_id', debtId)
          .order('paid_on')
          .order('created_at'),
        client.from('installment_status').select(COLUMNS.installment).eq('book_id', bookId).eq('debt_id', debtId).order('seq'),
      ]);

      const [debt] = z.array(debtRowSchema).parse(unwrap(debtRes));
      if (!debt) throw new NotFoundError(`catatan ${debtId}`);
      if (metaRes.error) throw new DataError(metaRes.error.code || 'unknown');
      if (!metaRes.data) throw new NotFoundError(`catatan ${debtId}`);
      const meta = debtMetaSchema.parse({ ...metaRes.data, debt_id: (metaRes.data as { id: string }).id });

      return {
        debt,
        memo: meta.memo,
        category: meta.category,
        payments: z.array(paymentRowSchema).parse(unwrap(paymentRes)),
        installments: unwrap(installmentRes).map(mapInstallmentRow),
      };
    },

    recordPayment: (payment) =>
      appendToLedger({
        id: payment.id,
        debt_id: payment.debtId,
        paid_on: payment.paidOn,
        amount_idr: payment.amountIdr,
        reference: payment.reference,
        note: payment.note,
      }),

    reversePayment: (reversal) =>
      appendToLedger({
        id: reversal.id,
        debt_id: reversal.debtId,
        paid_on: reversal.paidOn,
        amount_idr: -reversal.amountIdr,
        reverses_payment_id: reversal.reversesPaymentId,
        note: reversal.note,
      }),

    async bookSettings() {
      const rows = z.array(bookSettingsRowSchema).parse(unwrap(await client.from('books').select(COLUMNS.bookSettings).eq('id', bookId)));
      const [row] = rows;
      if (!row) throw new NotFoundError('buku');
      return { name: row.name, paydayDay: row.payday_day, baseSalaryIdr: row.base_salary_idr };
    },

    async updateBookSettings(update) {
      const result = await client
        .from('books')
        .update({ payday_day: update.paydayDay, base_salary_idr: update.baseSalaryIdr })
        .eq('id', bookId)
        .select('id');
      // PostgREST/Postgres errors carry a code; a transport failure has an empty one.
      if (result.error) throw new SettingsWriteError(result.error.code ? 'rejected' : 'network');
      // Row-level security filters rows the user may not update instead of failing: zero rows means "not allowed".
      if (!result.data || result.data.length !== 1) throw new SettingsWriteError('rejected');
    },

    async inboxPendingCount() {
      const { count, error } = await client
        .from('inbox_events')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId)
        .eq('status', 'pending');
      if (error) throw new DataError(error.code || 'unknown');
      return count ?? 0;
    },
  };
}
