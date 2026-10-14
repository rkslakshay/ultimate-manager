/**
 * Pure calendar-date arithmetic. The engine may not use `Date` (it depends on the host clock
 * and time zone), so game dates are integer day numbers: days since 1970-01-01 (proleptic
 * Gregorian). ISO `YYYY-MM-DD` strings are used only at the boundaries (API/DB/UI).
 *
 * Algorithms: Howard Hinnant's `days_from_civil` / `civil_from_days`.
 */

export type DayNumber = number;

export interface CivilDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

export function dayFromCivil(year: number, month: number, day: number): DayNumber {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDay(dayNumber: DayNumber): CivilDate {
  const z = dayNumber + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(iso: string): DayNumber {
  const m = ISO_RE.exec(iso);
  if (!m) throw new RangeError(`Invalid ISO date: ${iso}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Invalid ISO date: ${iso}`);
  }
  return dayFromCivil(year, month, day);
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

export function toIsoDate(dayNumber: DayNumber): string {
  const { year, month, day } = civilFromDay(dayNumber);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 0 = Monday … 6 = Sunday. (1970-01-01 was a Thursday.) */
export function weekday(dayNumber: DayNumber): number {
  return (((dayNumber + 3) % 7) + 7) % 7;
}

/** Whole years between a birth date and `on` (both day numbers). */
export function ageOn(birth: DayNumber, on: DayNumber): number {
  const b = civilFromDay(birth);
  const d = civilFromDay(on);
  let age = d.year - b.year;
  if (d.month < b.month || (d.month === b.month && d.day < b.day)) age--;
  return age;
}

/** Same calendar day `years` later (29 Feb → 28 Feb in non-leap years). */
export function addYears(dayNumber: DayNumber, years: number): DayNumber {
  const { year, month, day } = civilFromDay(dayNumber);
  const y = year + years;
  return dayFromCivil(y, month, Math.min(day, daysInMonth(y, month)));
}
