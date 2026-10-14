/** Top-level game sections shown in the sidebar, in display order. */
export const GAME_SECTIONS = [
  { id: 'inbox', label: 'Inbox', shortcut: 'i' },
  { id: 'squad', label: 'Squad', shortcut: 's' },
  { id: 'tactics', label: 'Tactics', shortcut: 't' },
  { id: 'training', label: 'Training', shortcut: 'r' },
  { id: 'transfers', label: 'Transfers', shortcut: 'x' },
  { id: 'scouting', label: 'Scouting', shortcut: 'o' },
  { id: 'finances', label: 'Finances', shortcut: 'f' },
  { id: 'club', label: 'Club', shortcut: 'c' },
  { id: 'fixtures', label: 'Fixtures', shortcut: 'u' },
  { id: 'league', label: 'League', shortcut: 'l' },
  { id: 'search', label: 'Search', shortcut: '/' },
] as const;

export type GameSectionId = (typeof GAME_SECTIONS)[number]['id'];
