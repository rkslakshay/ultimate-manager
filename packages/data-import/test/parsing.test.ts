import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseIsoDate, toIsoDate } from '@um/engine';
import { afterAll, describe, expect, it } from 'vitest';
import { detectEncoding, readCsv, streamCsv } from '../src/csv-stream';
import {
  jaroWinkler,
  normalizeClubName,
  normalizeName,
  parseDateFlexible,
  parseNumber,
} from '../src/normalize';
import { detectTable, resolveColumns, TM_VALUATIONS } from '../src/sources/columns';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'um-csv-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const file = (name: string, content: string | Buffer) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, content);
  return f;
};

describe('streamCsv', () => {
  it('handles quotes, escaped quotes, embedded newlines, CRLF and a BOM', async () => {
    const f = file('a.csv', '﻿id,name,note\r\n1,"Smith, J","said ""hi"""\r\n2,"two\nlines",x\r\n');
    const { header, rows } = await readCsv(f);
    expect(header).toEqual(['id', 'name', 'note']);
    expect(rows).toEqual([
      { id: '1', name: 'Smith, J', note: 'said "hi"' },
      { id: '2', name: 'two\nlines', note: 'x' },
    ]);
  });

  it('stops at a row limit and reports empty files', async () => {
    const f = file('b.csv', 'x\n1\n2\n3\n');
    const seen: string[] = [];
    await streamCsv(f, (r) => seen.push(r.x!), { limit: 2 });
    expect(seen).toEqual(['1', '2']);
    const empty = await readCsv(file('c.csv', ''));
    expect(empty).toEqual({ header: [], rows: [] });
  });

  it('detects UTF-8 vs Latin-1 and decodes accordingly', async () => {
    const latin = file(
      'd.csv',
      Buffer.from([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x4a, 0x6f, 0x73, 0xe9, 0x0a]),
    ); // "name\nJosé" in Latin-1
    expect(detectEncoding(latin)).toBe('latin1');
    expect((await readCsv(latin)).rows[0]!.name).toBe('José');
    expect(detectEncoding(file('e.csv', 'name\nJosé\n'))).toBe('utf8');
  });

  it('rejects an unterminated quoted field', async () => {
    await expect(readCsv(file('f.csv', 'a\n"broken\n'))).rejects.toThrow(/unterminated/);
  });
});

describe('normalisation', () => {
  it('ignores accents, case and punctuation but keeps letters', () => {
    expect(normalizeName('  José  MARÍA-López ')).toBe('jose maria lopez');
    expect(normalizeName('Ødegård')).toBe('odegard');
    expect(normalizeName('Nikolić')).toBe('nikolic');
    expect(normalizeClubName('FC Example City')).toBe(normalizeClubName('Example City FC'));
  });

  it('scores similar names high and different ones low', () => {
    expect(jaroWinkler('stanshaw', 'stanshawe')).toBeGreaterThan(0.95);
    expect(jaroWinkler('smith', 'jones')).toBeLessThan(0.6);
  });

  it('parses dates and numbers without inventing values', () => {
    expect(toIsoDate(parseDateFlexible('2001-02-03 00:00:00')!)).toBe('2001-02-03');
    expect(toIsoDate(parseDateFlexible('3/2/2001')!)).toBe('2001-02-03');
    expect(parseDateFlexible('2001-02-30')).toBeNull();
    expect(parseDateFlexible('')).toBeNull();
    expect(parseDateFlexible('yesterday')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('nan')).toBeNull();
    expect(parseNumber('1,500,000')).toBe(1_500_000);
    expect(parseNumber('0')).toBe(0);
    expect(parseIsoDate('2001-02-03')).toBe(parseDateFlexible('2001-02-03'));
  });
});

describe('column resolution', () => {
  it('matches headers case- and punctuation-insensitively and reports gaps', () => {
    const r = resolveColumns(['Player_ID', 'DATE', 'other'], TM_VALUATIONS);
    expect(r.map.playerId).toBe('Player_ID');
    expect(r.map.date).toBe('DATE');
    expect(r.missingRequired).toEqual(['valueEur']);
    expect(r.unused).toEqual(['other']);
  });

  it('detects table kinds by file name and header', () => {
    expect(detectTable('player_valuations.csv', ['player_id', 'date', 'market_value_in_eur'])).toBe(
      'tmValuations',
    );
    expect(
      detectTable('whatever.csv', [
        'player_id',
        'short_name',
        'player_positions',
        'overall',
        'potential',
      ]),
    ).toBe('eaPlayers');
    expect(detectTable('players.csv', ['player_id', 'name', 'date_of_birth'])).toBe('tmPlayers');
    expect(detectTable('notes.csv', ['foo', 'bar'])).toBeNull();
  });
});

describe('table detection on the real datasets’ headers (column names only)', () => {
  const EA_HEADER = [
    'player_id',
    'player_url',
    'fifa_version',
    'fifa_update',
    'short_name',
    'long_name',
    'player_positions',
    'overall',
    'potential',
    'value_eur',
    'wage_eur',
    'dob',
    'club_team_id',
    'club_name',
    'league_name',
    'league_level',
  ];
  it('reads the men’s ratings table and keeps women’s tables out of the world', () => {
    expect(detectTable('male_players.csv', EA_HEADER)).toBe('eaPlayers');
    expect(detectTable('female_players.csv', EA_HEADER)).toBeNull();
    expect(detectTable('players_womens.csv', EA_HEADER)).toBeNull();
    expect(
      detectTable('male_teams.csv', ['team_id', 'team_name', 'league_id', 'overall']),
    ).toBeNull();
  });

  it('recognises Transfermarkt-style tables by name, not by shared id/name columns', () => {
    expect(
      detectTable('players.csv', [
        'player_id',
        'first_name',
        'last_name',
        'name',
        'date_of_birth',
        'market_value_in_eur',
      ]),
    ).toBe('tmPlayers');
    expect(
      detectTable('clubs.csv', [
        'club_id',
        'club_code',
        'name',
        'domestic_competition_id',
        'stadium_name',
        'stadium_seats',
      ]),
    ).toBe('tmClubs');
    expect(
      detectTable('competitions.csv', [
        'competition_id',
        'competition_code',
        'name',
        'sub_type',
        'type',
        'country_name',
      ]),
    ).toBe('tmCompetitions');
    expect(
      detectTable('transfers.csv', [
        'player_id',
        'transfer_date',
        'transfer_season',
        'from_club_id',
        'to_club_id',
        'transfer_fee',
      ]),
    ).toBe('tmTransfers');
    expect(
      detectTable('player_valuations.csv', [
        'player_id',
        'date',
        'market_value_in_eur',
        'current_club_id',
      ]),
    ).toBe('tmValuations');
    // Match logs share player_id / club_id / name columns but are NOT players or clubs.
    expect(
      detectTable('appearances.csv', [
        'appearance_id',
        'game_id',
        'player_id',
        'player_club_id',
        'date',
        'player_name',
        'minutes_played',
      ]),
    ).toBeNull();
    expect(
      detectTable('game_lineups.csv', [
        'game_lineups_id',
        'date',
        'game_id',
        'player_id',
        'club_id',
        'player_name',
        'type',
        'position',
      ]),
    ).toBeNull();
    expect(
      detectTable('game_events.csv', [
        'game_event_id',
        'date',
        'game_id',
        'minute',
        'type',
        'club_id',
        'club_name',
        'player_id',
      ]),
    ).toBeNull();
  });
});
