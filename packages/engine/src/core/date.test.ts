import { describe, expect, it } from 'vitest';
import {
  addYears,
  ageOn,
  civilFromDay,
  dayFromCivil,
  daysInMonth,
  parseIsoDate,
  toIsoDate,
  weekday,
} from './date';

describe('civil date arithmetic', () => {
  it('maps the epoch and known dates', () => {
    expect(dayFromCivil(1970, 1, 1)).toBe(0);
    expect(toIsoDate(0)).toBe('1970-01-01');
    expect(parseIsoDate('2000-03-01') - parseIsoDate('2000-02-28')).toBe(2); // leap year
    expect(parseIsoDate('1900-03-01') - parseIsoDate('1900-02-28')).toBe(1); // not a leap year
  });

  it('round-trips every day over four centuries', () => {
    const start = dayFromCivil(1800, 1, 1);
    const end = dayFromCivil(2200, 12, 31);
    for (let d = start; d <= end; d++) {
      const { year, month, day } = civilFromDay(d);
      expect(dayFromCivil(year, month, day)).toBe(d);
      expect(day).toBeLessThanOrEqual(daysInMonth(year, month));
    }
  });

  it('parses and formats ISO dates, rejecting invalid ones', () => {
    expect(toIsoDate(parseIsoDate('2026-07-01'))).toBe('2026-07-01');
    expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseIsoDate('26-7-1')).toThrow(RangeError);
  });

  it('computes weekdays (0 = Monday)', () => {
    expect(weekday(parseIsoDate('2026-07-01'))).toBe(2); // Wednesday
    expect(weekday(parseIsoDate('1970-01-01'))).toBe(3); // Thursday
    expect(weekday(parseIsoDate('1969-12-29'))).toBe(0); // Monday, negative day number
  });

  it('computes ages and adds years', () => {
    const birth = parseIsoDate('2000-07-02');
    expect(ageOn(birth, parseIsoDate('2026-07-01'))).toBe(25);
    expect(ageOn(birth, parseIsoDate('2026-07-02'))).toBe(26);
    expect(toIsoDate(addYears(parseIsoDate('2024-02-29'), 1))).toBe('2025-02-28');
    expect(toIsoDate(addYears(parseIsoDate('2026-07-01'), -20))).toBe('2006-07-01');
  });
});
