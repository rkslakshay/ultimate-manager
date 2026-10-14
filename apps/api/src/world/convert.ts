import type { DayNumber } from '@um/engine';

const MS_PER_DAY = 86_400_000;

/** Engine day number → JS Date at UTC midnight (for @db.Date columns). */
export const dayToDate = (day: DayNumber): Date => new Date(day * MS_PER_DAY);

/** @db.Date value (UTC midnight) → engine day number. */
export const dateToDay = (date: Date): DayNumber => Math.floor(date.getTime() / MS_PER_DAY);

/** @db.Date value → ISO YYYY-MM-DD. */
export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

/** Split an array into chunks (bulk inserts stay under Postgres' parameter limit). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
