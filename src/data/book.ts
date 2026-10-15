import { z } from 'zod';

export const bookSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  timezone: z.string().min(1),
  payday_day: z.number().int(),
  base_salary_idr: z.number().int().nullable(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
});

export type Book = z.infer<typeof bookSchema>;

/**
 * The book picker is not built yet, so the active book is the oldest non-archived one.
 * `null` means the account has no book (the first one is created manually with supabase/scripts/first-book.sql).
 */
export function pickActiveBook(books: readonly Book[]): Book | null {
  const open = books.filter((b) => b.archived_at === null);
  open.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id.localeCompare(b.id)));
  return open[0] ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params are user-controlled; a non-UUID would make Postgres raise an error instead of "not found". */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
