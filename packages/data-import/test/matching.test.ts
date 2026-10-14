import { parseIsoDate } from '@um/engine';
import { describe, expect, it } from 'vitest';
import { importConfigSchema } from '../src/config';
import { matchClubs, matchPlayers } from '../src/matching';
import type { EaPlayer, TmClub, TmPlayer } from '../src/sources/records';

const config = (over: object = {}) => importConfigSchema.parse(over);
const day = (s: string) => parseIsoDate(s);

function ea(
  id: string,
  name: string,
  fullName: string | null,
  dob: string | null,
  nat = 'Northland',
  club = 'A',
): EaPlayer {
  return {
    sourceId: id,
    name,
    fullName,
    dob: dob ? day(dob) : null,
    age: 25,
    nationality: nat,
    positions: ['ST'],
    overall: 70,
    potential: 72,
    valueEur: null,
    wageEur: null,
    releaseClauseEur: null,
    heightCm: 180,
    weightKg: 75,
    foot: 'right',
    weakFoot: 3,
    skillMoves: 3,
    internationalReputation: 1,
    workRate: null,
    traits: [],
    clubSourceId: club,
    clubName: `Club ${club}`,
    leagueSourceId: '1',
    leagueName: 'L',
    leagueLevel: 1,
    jersey: 9,
    contractUntilYear: 2028,
    joined: null,
    ratings: {},
    version: null,
  };
}
function tm(
  id: string,
  name: string,
  dob: string | null,
  nat = 'Northland',
  club = '100',
): TmPlayer {
  const [firstName, ...rest] = name.split(' ');
  return {
    sourceId: id,
    name,
    firstName: firstName ?? null,
    lastName: rest.join(' ') || null,
    dob: dob ? day(dob) : null,
    nationality: nat,
    position: null,
    subPosition: null,
    foot: null,
    heightCm: 180,
    contractEnd: null,
    marketValueEur: null,
    clubSourceId: club,
    clubName: null,
    competitionId: null,
  };
}

describe('player identity matching', () => {
  it('matches the same person across sources by full name + birth date, ignoring accents', () => {
    const m = matchPlayers(
      [ea('1', 'J. Lopez', 'José Lopez', '2000-01-01')],
      [tm('a', 'Jose López', '2000-01-01')],
      config(),
    );
    expect(m.pairs.map((p) => [p.ea.sourceId, p.tm.sourceId, p.method])).toEqual([
      ['1', 'a', 'full_name_dob'],
    ]);
  });

  it('never merges different players who share a name but not a birth date', () => {
    const m = matchPlayers(
      [ea('1', 'J. Smith', 'John Smith', '1999-05-05')],
      [tm('a', 'John Smith', '1998-05-05')],
      config(),
    );
    expect(m.pairs).toHaveLength(0);
    expect(m.eaUnmatched).toHaveLength(1);
    expect(m.tmUnmatched).toHaveLength(1);
  });

  it('flags ambiguous identities (two candidates) instead of guessing', () => {
    const m = matchPlayers(
      [
        ea('1', 'J. Smith', 'John Smith', '1999-05-05', 'Northland', 'A'),
        ea('2', 'J. Smith', 'John Smith', '1999-05-05', 'Northland', 'B'),
      ],
      [tm('a', 'John Smith', '1999-05-05')],
      config(),
    );
    expect(m.pairs).toHaveLength(0);
    expect(m.ambiguous.map((a) => a.ea.sourceId).sort()).toEqual(['1', '2']);
  });

  it('only proposes fuzzy candidates, never merges them, and honours manual approvals and rejections', () => {
    const eaRows = [ea('1', 'O. Stanshaw', 'Owen Stanshaw', '2001-01-01')];
    const tmRows = [tm('a', 'Owen Stanshawe', '2001-01-01')];
    const m = matchPlayers(eaRows, tmRows, config());
    expect(m.pairs).toHaveLength(0);
    expect(m.candidates[0]).toMatchObject({ score: expect.any(Number) });
    const approved = matchPlayers(
      eaRows,
      tmRows,
      config({ identity: { approve: [{ ea: '1', tm: 'a' }] } }),
    );
    expect(approved.pairs[0]!.method).toBe('approved');
    const rejected = matchPlayers(
      [ea('1', 'J. Lopez', 'Jose Lopez', '2000-01-01')],
      [tm('a', 'Jose Lopez', '2000-01-01')],
      config({ identity: { reject: [{ ea: '1', tm: 'a' }] } }),
    );
    expect(rejected.pairs).toHaveLength(0);
  });

  it('falls back to surname + birth date + nationality, and reports conflicting fields', () => {
    const m = matchPlayers(
      [ea('1', 'Pele Junior', null, '2002-02-02', 'Southmoor')],
      [tm('a', 'Edson Junior', '2002-02-02', 'Southmoor')],
      config(),
    );
    expect(m.pairs[0]!.method).toBe('surname_dob_nationality');
    const c = matchPlayers(
      [ea('1', 'J. Lopez', 'Jose Lopez', '2000-01-01', 'Northland')],
      [tm('a', 'Jose Lopez', '2000-01-01', 'Southmoor')],
      config(),
    );
    expect(c.pairs).toHaveLength(1);
    expect(c.conflicts).toEqual([expect.objectContaining({ field: 'nationality' })]);
  });

  it('cannot match players without a birth date', () => {
    const m = matchPlayers(
      [ea('1', 'J. Lopez', 'Jose Lopez', null)],
      [tm('a', 'Jose Lopez', '2000-01-01')],
      config(),
    );
    expect(m.pairs).toHaveLength(0);
    expect(m.eaWithoutDob).toBe(1);
  });
});

describe('club matching', () => {
  const tmClub = (id: string, name: string): TmClub => ({
    sourceId: id,
    name,
    competitionId: 'C',
    stadiumName: null,
    stadiumSeats: null,
  });
  it('prefers player-overlap evidence, then exact normalised names', () => {
    const players = ['1', '2', '3'].map((i) =>
      ea(i, `P ${i}`, `Player ${i}`, `200${i}-01-01`, 'Northland', 'X'),
    );
    const pairs = players.map((p, i) => ({
      ea: p,
      tm: tm(`t${i}`, p.fullName!, null, 'Northland', '500'),
      method: 'full_name_dob' as const,
    }));
    const other = ea('9', 'Q', 'Q Q', '1990-01-01', 'Northland', 'Y');
    other.clubName = 'Example United';
    const m = matchClubs(
      [...players, other],
      [tmClub('500', 'Totally Different Name'), tmClub('600', 'Example United FC')],
      pairs,
      config(),
    );
    expect(m.byEaClub.get('id:X')).toMatchObject({ method: 'player_overlap' });
    expect(m.byEaClub.get('id:Y')).toMatchObject({ method: 'exact_name' });
    expect(m.unmatched).toEqual([]);
  });
});
