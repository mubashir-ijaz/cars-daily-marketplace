// Every marketplace gets its own tab. To add one later (e.g. Craigslist,
// OfferUp, Cars.com), add an entry here and have its scanner POST to
// /api/ingest with the same `id` as `source`.
export type Source = { id: string; name: string; short: string };

export const SOURCES: Source[] = [
  { id: 'facebook', name: 'Facebook Marketplace', short: 'Facebook' },
];

export const getSource = (id: string | undefined | null) =>
  SOURCES.find((s) => s.id === id) ?? SOURCES[0];

export const isSource = (id: unknown): id is string =>
  typeof id === 'string' && SOURCES.some((s) => s.id === id);
