import type { InstallmentRow } from './schemas';
import { installmentRowSchema } from './schemas';

/** Row of the `installment_status` view. The view calls the key `installment_id`; the UI schema calls it `id`. */
export function mapInstallmentRow(row: unknown): InstallmentRow {
  const { installment_id, ...rest } = row as { installment_id?: unknown } & Record<string, unknown>;
  return installmentRowSchema.parse({ id: installment_id, ...rest });
}
