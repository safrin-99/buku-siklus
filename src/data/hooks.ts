import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from './context';
import { PaymentWriteError } from './paymentErrors';
import type { NewPayment, NewReversal } from './source';

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
function assertOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new PaymentWriteError('offline');
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
      assertOnline();
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
      assertOnline();
      await source.reversePayment(reversal);
    },
    onSettled: () => client.invalidateQueries({ queryKey: [source.bookId] }),
  });
}
