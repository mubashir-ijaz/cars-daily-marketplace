export type Kind = 'deal' | 'novin';
/** today = found in the last 24 h, yesterday = 24–48 h ago. Older cars are deleted. */
export type Day = 'today' | 'yesterday';

export type Car = {
  source: string;
  id: string;
  kind: Kind;
  url: string;
  title: string | null;
  price: number | null;
  mileage: number | null;
  vin: string | null;
  year: number | null;
  location: string | null;
  search: string | null;
  img: string | null;
  mmrName: string | null;
  mmrBase: number | null;
  mmrGrade: number | null;
  /** MMR used for the spread (grade-adjusted when available). */
  mmr: number | null;
  /** mmr - price */
  profit: number | null;
  /** Extra details read from the listing (all optional). */
  description?: string | null;
  phone?: string | null;
  titleStatus?: string | null;
  owners?: number | null;
  carfax?: string | null;
  accidents?: string | null;
  issues?: string | null;
  transmission?: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  fuel?: string | null;
  sellerName?: string | null;
  sellerJoined?: number | null;
  listed?: string | null;
  firstSeen: number;
  updatedAt: number;
  hidden?: boolean;
};
