import type { NameFlavour } from '../names/flavours';

export interface NationDefinition {
  name: string;
  adjective: string;
  code: string;
  flavour: NameFlavour;
  reputation: number;
  /** Club counts per division (top first). Empty for nations without a playable league. */
  divisions: number[];
}

/**
 * The default fictional world. Three nations have two-division league systems; the others
 * supply players of other nationalities. All names are invented.
 */
export const DEFAULT_NATIONS: NationDefinition[] = [
  {
    name: 'Valdoria',
    adjective: 'Valdorian',
    code: 'VAL',
    flavour: 'latin',
    reputation: 88,
    divisions: [20, 20],
  },
  {
    name: 'Ardenia',
    adjective: 'Ardenian',
    code: 'ARD',
    flavour: 'anglo',
    reputation: 84,
    divisions: [18, 20],
  },
  {
    name: 'Skarnland',
    adjective: 'Skarnish',
    code: 'SKA',
    flavour: 'nordic',
    reputation: 72,
    divisions: [16, 18],
  },
  {
    name: 'Montclaire',
    adjective: 'Montclairian',
    code: 'MCL',
    flavour: 'franco',
    reputation: 80,
    divisions: [],
  },
  {
    name: 'Altrevia',
    adjective: 'Altrevian',
    code: 'ALT',
    flavour: 'germanic',
    reputation: 79,
    divisions: [],
  },
  {
    name: 'Porvera',
    adjective: 'Porveran',
    code: 'POV',
    flavour: 'lusophone',
    reputation: 76,
    divisions: [],
  },
  {
    name: 'Teluria',
    adjective: 'Telurian',
    code: 'TEL',
    flavour: 'latin',
    reputation: 71,
    divisions: [],
  },
  {
    name: 'Kovastan',
    adjective: 'Kovastani',
    code: 'KOV',
    flavour: 'slavic',
    reputation: 67,
    divisions: [],
  },
  {
    name: 'Zembara',
    adjective: 'Zembaran',
    code: 'ZEM',
    flavour: 'westAfrican',
    reputation: 64,
    divisions: [],
  },
];

export const DIVISION_NAMES = ['Premier Division', 'First Division', 'Second Division'];

export const CLUB_COLOURS: [string, string][] = [
  ['#c8102e', '#ffffff'],
  ['#1d428a', '#ffffff'],
  ['#006a4e', '#ffffff'],
  ['#fdb913', '#1b1b1b'],
  ['#5b2c83', '#f2c300'],
  ['#000000', '#ffffff'],
  ['#ffffff', '#1d428a'],
  ['#e35205', '#1b1b1b'],
  ['#7a1f3d', '#7ec8e3'],
  ['#0f7fbf', '#f5d000'],
  ['#2e7d32', '#fdd835'],
  ['#b71c1c', '#1a237e'],
  ['#004d40', '#ff7043'],
  ['#ffffff', '#c8102e'],
  ['#263238', '#ffca28'],
  ['#0277bd', '#ffffff'],
  ['#8e24aa', '#ffffff'],
  ['#f9a825', '#0d47a1'],
];
