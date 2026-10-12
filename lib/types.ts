export type Kind = 'deal' | 'novin';

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
  firstSeen: number;
  updatedAt: number;
  hidden?: boolean;
};
