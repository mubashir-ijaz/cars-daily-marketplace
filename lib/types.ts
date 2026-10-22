/**
 * deal = individual seller, MMR − price >= MIN_PROFIT · individual = any other individual-seller car (profit or loss)
 * dealer = seller with DEALER_CARS+ cars or dealership wording · novin = old no-VIN tab (SHOW_NO_VIN).
 */
export type Kind = 'deal' | 'individual' | 'dealer' | 'novin';

/** A seller the scanner found to be a dealer. Kept permanently so the next scans skip them right away. */
export type Dealer = {
  id: string;
  name: string | null;
  /** Cars on their Marketplace profile when they were checked. */
  cars: number | null;
  titles: string[];
  /** 'profile' (3+ cars listed), 'listing text' (financing, dealership…) or 'manual'. */
  reason: string;
  location: string | null;
  firstSeen: number;
  lastSeen: number;
};
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
  /** How the MMR was found: from the VIN, or from the title (year / make / model / trim) when there is no VIN. */
  mmrBy?: 'vin' | 'name' | null;
  /** Shown on the card: what the name lookup matched, or why there is no MMR. */
  mmrNote?: string | null;
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
  /** Facebook profile id of the seller (used to skip known dealers). */
  sellerId?: string | null;
  sellerJoined?: number | null;
  /** Cars (not parts) on the seller's Marketplace profile, and all their active listings. */
  sellerCars?: number | null;
  sellerListings?: number | null;
  /** Why the scanner called this seller a dealer. */
  dealerReason?: string | null;
  listed?: string | null;
  firstSeen: number;
  updatedAt: number;
  hidden?: boolean;
};
