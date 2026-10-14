import { daysInMonth, parseIsoDate, toIsoDate, type DayNumber } from '@um/engine';

/**
 * Identity normalisation: case-, accent- and punctuation-insensitive, whitespace collapsed.
 * Used only for matching; original names are always kept for display.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/đ/gi, 'd')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Generic club words dropped when comparing club names ("FC", "CF", "AFC", "SC"...). */
const CLUB_NOISE = new Set([
  'fc',
  'cf',
  'afc',
  'sc',
  'ac',
  'as',
  'ssc',
  'club',
  'de',
  'fk',
  'sk',
  'if',
  'bk',
  'calcio',
  'football',
  'the',
  '1',
]);

export function normalizeClubName(name: string): string {
  const words = normalizeName(name)
    .split(' ')
    .filter((w) => w && !CLUB_NOISE.has(w));
  return words.join(' ') || normalizeName(name);
}

/** Jaro-Winkler similarity (0-1), used only to propose candidates for manual review. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatch = new Array<boolean>(a.length).fill(false);
  const bMatch = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bMatch[j] || a[i] !== b[j]) continue;
      aMatch[i] = bMatch[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Parse a date from the formats seen in football datasets: ISO (YYYY-MM-DD, optionally with a
 * time), D/M/YYYY and YYYY/MM/DD. Returns null for empty or invalid values (never guesses).
 */
export function parseDateFlexible(raw: string | undefined): DayNumber | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) return safeDay(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (m) return safeDay(+m[3]!, +m[2]!, +m[1]!);
  return null;
}

function safeDay(y: number, mo: number, d: number): DayNumber | null {
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return parseIsoDate(
    `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  );
}

export const isoOrNull = (day: DayNumber | null) => (day === null ? null : toIsoDate(day));

/** Parse a number; empty, "nan", "-" and junk become null (never 0). */
export function parseNumber(raw: string | undefined): number | null {
  const s = (raw ?? '').trim().replace(/,/g, '');
  if (!s || /^(nan|null|none|n\/a|-|\?)$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(raw: string | undefined): number | null {
  const n = parseNumber(raw);
  return n === null ? null : Math.round(n);
}
