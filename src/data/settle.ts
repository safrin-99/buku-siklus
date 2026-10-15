/**
 * Outcome of a ledger write whose response may have been lost.
 * - saved:    the row exists (this attempt or an earlier one with the same id).
 * - rejected: the server answered and the row does not exist (retrying the same input will fail the same way).
 * - network:  the request failed in transit and the row verifiably does not exist (safe to retry).
 * - unknown:  the request failed and the existence check failed too (the row may or may not exist).
 */
export type WriteOutcome = 'saved' | 'rejected' | 'network' | 'unknown';

/**
 * Why an error alone is not enough: with a client-generated id, retrying a write whose response was lost fails with a
 * misleading error even though the row is saved (a retried final payment hits "exceeds total", a retried reversal
 * hits "negative total"; verified against Postgres). So after ANY failure the row is looked up by id.
 *
 * `attempt` resolves to an error (or null on success); a throw counts as a transport error.
 */
export async function settleWrite<E>(
  attempt: () => Promise<E | null>,
  exists: () => Promise<boolean>,
  isNetworkError: (error: E) => boolean,
): Promise<WriteOutcome> {
  let error: E | null;
  try {
    error = await attempt();
  } catch (thrown) {
    error = thrown as E;
  }
  if (error === null) return 'saved';

  let present: boolean;
  try {
    present = await exists();
  } catch {
    return 'unknown';
  }
  if (present) return 'saved';
  return isNetworkError(error) ? 'network' : 'rejected';
}
