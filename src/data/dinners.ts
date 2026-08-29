/**
 * Mock dinner data for the scaffold.
 * TODO(firebase): replace with a Firestore query (collection "dinners").
 */

export type Dinner = {
  id: string;
  title: string;
  host: string;
  city: string;
  date: string; // ISO date
  pricePerSeat: number; // in the smallest display unit (whole currency here)
  currency: "CZK" | "EUR";
  seatsLeft: number;
  image: string; // emoji placeholder for now
};

export const DINNERS: Dinner[] = [
  {
    id: "sunday-roast-chicken",
    title: "Classic Sunday roast chicken",
    host: "Eliška",
    city: "Praha",
    date: "2026-09-06",
    pricePerSeat: 450,
    currency: "CZK",
    seatsLeft: 4,
    image: "🍗",
  },
  {
    id: "slow-roast-pork",
    title: "Slow-roast pork & dumplings",
    host: "Tomáš",
    city: "Brno",
    date: "2026-09-12",
    pricePerSeat: 520,
    currency: "CZK",
    seatsLeft: 2,
    image: "🥘",
  },
  {
    id: "autumn-veggie-feast",
    title: "Autumn roasted veggie feast",
    host: "Marta",
    city: "Olomouc",
    date: "2026-09-19",
    pricePerSeat: 390,
    currency: "CZK",
    seatsLeft: 6,
    image: "🥕",
  },
];

export function formatPrice(dinner: Dinner): string {
  return `${dinner.pricePerSeat} ${dinner.currency}`;
}
