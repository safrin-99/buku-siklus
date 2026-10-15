import type { DataSource } from './source';

/**
 * Opens the data source for this session. `null` = the user has no book yet.
 * The fixture branch is guarded by `MODE`, which is a build-time constant, so sample data
 * does not ship in the production bundle (verified by building without --mode fixture).
 */
export async function openDataSource(): Promise<DataSource | null> {
  if (import.meta.env.MODE === 'fixture') {
    const { createFixtureSource } = await import('./fixtureSource');
    return createFixtureSource();
  }
  throw new Error('Supabase data source is not available in this version yet.');
}
