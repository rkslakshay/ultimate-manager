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
    lastSeason: null,
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

  it('matches a long name with extra surnames to the shorter common name (same first name + DOB)', () => {
    const m = matchPlayers(
      [
        ea('1', 'O. Stanshaw', 'Owen Stanshaw Bellamy', '2001-01-01', 'Northland'),
        ea('2', 'P. Quill', 'Peter Andrés Quill Marrow', '1990-06-06', 'Southmoor'),
      ],
      // Nationality spelled differently in the other source: still matched (and reported).
      [tm('a', 'Owen Stanshaw', '2001-01-01'), tm('b', 'Peter Quill', '1990-06-06', 'South Moor')],
      config(),
    );
    expect(m.pairs.map((p) => [p.ea.sourceId, p.tm.sourceId, p.method]).sort()).toEqual([
      ['1', 'a', 'name_tokens_dob'],
      ['2', 'b', 'name_tokens_dob'],
    ]);
    // A different first name or tokens out of order is not enough.
    const none = matchPlayers(
      [
        ea('1', 'O. Stanshaw', 'Owen Stanshaw Bellamy', '2001-01-01'),
        ea('2', 'P. Quill', 'Peter Marrow Quill', '1990-06-06', 'Eastvale'),
      ],
      [
        tm('a', 'Oscar Stanshaw', '2001-01-01'),
        tm('b', 'Peter Quill Marrow', '1990-06-06', 'Westvale'),
      ],
      config(),
    );
    expect(none.pairs).toHaveLength(0);
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
  const tmClub = (id: string, name: string, code: string | null = null): TmClub => ({
    sourceId: id,
    name,
    code,
    competitionId: 'C',
    stadiumName: null,
    stadiumSeats: null,
    lastSeason: null,
  });
  it('matches by exact normalised name, then by player overlap', () => {
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

  // Clubs X..Z with n players each; `at` says where each matched player plays now.
  const squad = (club: string, at: string[], size = at.length) =>
    Array.from({ length: size }, (_, i) => {
      const e = ea(
        `${club}${i}`,
        `P ${club}${i}`,
        `Player ${club}${i}`,
        '2000-01-01',
        'Northland',
        club,
      );
      e.clubName = `Club ${club}`;
      return {
        e,
        pair: at[i]
          ? {
              ea: e,
              tm: tm(`t${club}${i}`, e.fullName!, null, 'Northland', at[i]),
              method: 'full_name_dob' as const,
            }
          : null,
      };
    });

  it('does not let a few players who moved on drag a club to their new club', () => {
    // Club X: 20 players, 3 matched and all now at club 500 (15% of the squad) → not matched.
    // Club Y: 10 players, 6 matched; 4 still at 600, 2 moved elsewhere → plurality, matched.
    const x = squad('X', ['500', '500', '500'], 20);
    const y = squad('Y', ['600', '600', '600', '600', '700', '800'], 10);
    const all = [...x, ...y];
    const m = matchClubs(
      all.map((r) => r.e),
      [
        tmClub('500', 'Elsewhere'),
        tmClub('600', 'Formal Name of Y'),
        tmClub('700', 'A'),
        tmClub('800', 'B'),
      ],
      all.flatMap((r) => (r.pair ? [r.pair] : [])),
      config(),
    );
    expect(m.byEaClub.has('id:X')).toBe(false);
    expect(m.byEaClub.get('id:Y')).toMatchObject({ method: 'player_overlap' });
  });

  it('matches a short common name to a formal name or URL slug when unique and backed by a player', () => {
    const rows = [
      ...squad('X', ['500']), // "Club X" ↔ "Sporting Club X Lisboa" (one player evidence)
      ...squad('Y', ['']), // "Club Y" ↔ slug "club-y-town" but no player evidence → not matched
    ];
    rows[0]!.e.clubName = 'Northvale';
    rows[1]!.e.clubName = 'Southvale';
    const m = matchClubs(
      rows.map((r) => r.e),
      [tmClub('500', 'Sociedade Desportiva Northvale'), tmClub('600', 'SV 1907', 'southvale-1907')],
      rows.flatMap((r) => (r.pair ? [r.pair] : [])),
      config(),
    );
    expect(m.byEaClub.get('id:X')).toMatchObject({ method: 'name_tokens' });
    expect(m.byEaClub.has('id:Y')).toBe(false);
  });

  it('treats the URL slug as an exact name', () => {
    const e = ea('1', 'P', 'P P', '2000-01-01', 'Northland', 'X');
    e.clubName = 'Northvale City';
    const m = matchClubs(
      [e],
      [tmClub('500', 'Northvale City Football Association', 'northvale-city-fc')],
      [],
      config(),
    );
    expect(m.byEaClub.get('id:X')).toMatchObject({ method: 'exact_name' });
  });
});
