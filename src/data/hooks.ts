import { useQuery } from '@tanstack/react-query';
import { useDataSource } from './context';

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
