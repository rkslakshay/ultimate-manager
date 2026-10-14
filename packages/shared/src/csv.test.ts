import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvObjects, toCsv } from './csv';

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [
      ['id', 'name', 'note'],
      ['1', 'Real "Big" Club', 'a,b'],
      ['2', 'Multi\nline', ''],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('handles CRLF, BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n3,4\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('parses objects by header and rejects unterminated quotes', () => {
    expect(parseCsvObjects('id,name\n7,Alpha')).toEqual([{ id: '7', name: 'Alpha' }]);
    expect(() => parseCsv('a,"broken')).toThrow(/Unterminated/);
  });
});
