const compactMoney = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const fullMoney = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat('en-GB');

/** €18.5M style for tables. */
export const money = (value: number) => compactMoney.format(value);
export const moneyFull = (value: number) => fullMoney.format(value);
/** Weekly wage: "€12K p/w". */
export const wage = (value: number | null) =>
  value === null ? '—' : `${compactMoney.format(value)} p/w`;
export const count = (value: number) => integer.format(value);

const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const contractEnd = (iso: string | null) =>
  iso ? monthYear.format(new Date(`${iso}T00:00:00Z`)) : '—';

export const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`;

export const SQUAD_STATUS_LABELS: Record<string, string> = {
  key: 'Key Player',
  firstTeam: 'First Team',
  rotation: 'Rotation',
  backup: 'Backup',
  prospect: 'Prospect',
};

/** Familiarity bands, FM-style. */
export function familiarityLabel(f: number): string {
  if (f >= 20) return 'Natural';
  if (f >= 15) return 'Accomplished';
  if (f >= 10) return 'Competent';
  if (f >= 6) return 'Unconvincing';
  return 'Awkward';
}
