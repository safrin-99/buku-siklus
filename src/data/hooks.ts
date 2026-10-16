import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from './context';
import { DebtWriteError } from './debtErrors';
import { PaymentWriteError } from './paymentErrors';
import { SettingsWriteError } from './settingsErrors';
import type { BookSettingsUpdate, DebtDetailsUpdate, NewDebt, NewPayment, NewReversal } from './source';

// Query keys always start with the book id: another book's data is never reused from the cache.

export function useToday(): string {
  return useDataSource().getToday();
}

export function useCycleSummary() {
  const source = useDataSource();
  return useQuery({ queryKey: [source.bookId, 'cycle-summary'], queryFn: () => source.cycleSummary() });
}

export function useDebts() {
  const source = useDataSource();
  return useQuery({ queryKey: [source.bookId, 'debts'], queryFn: () => source.debts() });
}

export function useDebtDetail(debtId: string) {
  const source = useDataSource();
  return useQuery({
    queryKey: [source.bookId, 'debt-detail', debtId],
    queryFn: () => source.debtDetail(debtId),
    retry: false,
  });
}

export function useInboxCount() {
  const source = useDataSource();
  return useQuery({ queryKey: [source.bookId, 'inbox-count'], queryFn: () => source.inboxPendingCount() });
}

/**
 * Writes are not queued offline (a queued money write could be duplicated or reordered); they fail fast instead.
 * Note: TanStack Query's default `networkMode: 'online'` PAUSES a mutation while offline and silently sends it once
 * the connection returns. That is exactly the hidden queue we do not want, so ledger mutations use 'always'
 * (found by scripts/e2e-local.mjs: the offline tap stayed on "Menyimpan…" and would have been sent later).
 */
function assertOnline(offline: () => Error) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw offline();
}

/**
 * After a write settles (even a failed one: the outcome may be unknown), everything for this book is refetched.
 * The promise is returned so `mutateAsync` resolves only once fresh numbers are in the cache.
 */
export function useRecordPayment() {
  const source = useDataSource();
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (payment: NewPayment) => {
      assertOnline(() => new PaymentWriteError('offline'));
      await source.recordPayment(payment);
    },
    onSettled: () => client.invalidateQueries({ queryKey: [source.bookId] }),
  });
}

export function useReversePayment() {
  const source = useDataSource();
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (reversal: NewReversal) => {
      assertOnline(() => new PaymentWriteError('offline'));
      await source.reversePayment(reversal);
    },
    onSettled: () => client.invalidateQueries({ queryKey: [source.bookId] }),
  });
}

export function useBookSettings() {
  const source = useDataSource();
  return useQuery({ queryKey: [source.bookId, 'book-settings'], queryFn: () => source.bookSettings(), retry: false });
}

/** Payday and salary change the cycle card, so everything for this book is refetched afterwards. */
export function useUpdateBookSettings() {
  const source = useDataSource();
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (update: BookSettingsUpdate) => {
      assertOnline(() => new SettingsWriteError('offline'));
      await source.updateBookSettings(update);
    },
    onSettled: () => client.invalidateQueries({ queryKey: [source.bookId] }),
  });
}

/** Installments due in [from, to] for the calendar. Invalidated with everything else of the book after any write. */
export function useInstallmentsBetween(from: string, to: string) {
  const source = useDataSource();
  return useQuery({ queryKey: [source.bookId, 'installments', from, to], queryFn: () => source.installmentsBetween(from, to) });
}

/** Record writes follow the ledger's rules: no hidden offline queue, and everything for the book is refetched after. */
export function useCreateDebt() {
  const source = useDataSource();
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (debt: NewDebt) => {
      assertOnline(() => new DebtWriteError('offline'));
      await source.createDebt(debt);
    },
    onSettled: () => client.invalidateQueries({ queryKey: [source.bookId] }),
  });
}

export function useUpdateDebtDetails(debtId: string) {
  const source = useDataSource();
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (update: DebtDetailsUpdate) => {
      assertOnline(() => new DebtWriteError('offline'));
      await source.updateDebtDetails(debtId, update);
    },
    onSettled: () => client.invalidateQueries({ queryKey: [source.bookId] }),
  });
}

export function useDeleteDebt(debtId: string) {
  const source = useDataSource();
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      assertOnline(() => new DebtWriteError('offline'));
      await source.deleteDebt(debtId);
    },
    // The detail of a deleted record would 404 on refetch: drop it, refetch the rest.
    onSuccess: () => client.removeQueries({ queryKey: [source.bookId, 'debt-detail', debtId] }),
    onSettled: () => client.invalidateQueries({ queryKey: [source.bookId] }),
  });
}
