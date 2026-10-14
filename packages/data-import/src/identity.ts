import fs from 'node:fs';
import path from 'node:path';

/**
 * Persistent source-key → canonical-id map, so the same real player/club keeps the same id
 * across re-imports (data-packs/processed/<pack>/identity-map.json). Keys look like
 * "ea:20801", "tm:8198", "club:id:11", "nation:spain", "league:la liga".
 */
export interface IdentityMapFile {
  format: 'um-identity-map';
  version: 1;
  players: Record<string, number>;
  clubs: Record<string, number>;
  nations: Record<string, number>;
  competitions: Record<string, number>;
}

type Kind = 'players' | 'clubs' | 'nations' | 'competitions';

export class IdentityMap {
  private readonly data: IdentityMapFile;
  private readonly next: Record<Kind, number>;
  /** Keys looked up during this import (to report entities that disappeared). */
  readonly touched: Record<Kind, Set<string>> = {
    players: new Set(),
    clubs: new Set(),
    nations: new Set(),
    competitions: new Set(),
  };
  readonly created: Record<Kind, number> = { players: 0, clubs: 0, nations: 0, competitions: 0 };

  constructor(data?: IdentityMapFile) {
    this.data = data ?? {
      format: 'um-identity-map',
      version: 1,
      players: {},
      clubs: {},
      nations: {},
      competitions: {},
    };
    const max = (o: Record<string, number>) => Object.values(o).reduce((m, v) => Math.max(m, v), 0);
    this.next = {
      players: max(this.data.players) + 1,
      clubs: max(this.data.clubs) + 1,
      nations: max(this.data.nations) + 1,
      competitions: max(this.data.competitions) + 1,
    };
  }

  static load(file: string): IdentityMap {
    if (!fs.existsSync(file)) return new IdentityMap();
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as IdentityMapFile;
    if (data.format !== 'um-identity-map') throw new Error(`${file} is not an identity map`);
    return new IdentityMap(data);
  }

  /**
   * Canonical id for an entity known under one or more source keys (first key found wins);
   * every key is then recorded against that id.
   */
  id(kind: Kind, keys: readonly string[]): number {
    const table = this.data[kind];
    let id = keys.map((k) => table[k]).find((v) => v !== undefined);
    if (id === undefined) {
      id = this.next[kind]++;
      this.created[kind]++;
    }
    for (const k of keys) {
      table[k] = id;
      this.touched[kind].add(k);
    }
    return id;
  }

  /** Highest id in use for a kind (generated entities are numbered after it). */
  maxId(kind: Kind): number {
    return this.next[kind] - 1;
  }

  save(file: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const sorted = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          ...this.data,
          players: sorted(this.data.players),
          clubs: sorted(this.data.clubs),
          nations: sorted(this.data.nations),
          competitions: sorted(this.data.competitions),
        },
        null,
        1,
      ),
    );
  }
}
