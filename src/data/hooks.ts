import { useQuery } from '@tanstack/react-query';
import { dataSource } from './index';

export function useToday(): string {
  return dataSource.getToday();
}

export function useCycleSummary() {
  return useQuery({ queryKey: ['cycle-summary'], queryFn: () => dataSource.cycleSummary() });
}

export function useDebts() {
  return useQuery({ queryKey: ['debts'], queryFn: () => dataSource.debts() });
}

export function useDebtDetail(debtId: string) {
  return useQuery({
    queryKey: ['debt-detail', debtId],
    queryFn: () => dataSource.debtDetail(debtId),
    retry: false,
  });
}

export function useInboxCount() {
  return useQuery({ queryKey: ['inbox-count'], queryFn: () => dataSource.inboxPendingCount() });
}
