import { GAME_SECTIONS, type GameSectionId } from '@um/shared';
import {
  ArrowLeftRight,
  Binoculars,
  Building2,
  CalendarDays,
  Dumbbell,
  Inbox,
  type LucideIcon,
  Search,
  Shirt,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';

interface SectionMeta {
  icon: LucideIcon;
  /** Build phase (see CLAUDE.md §6) in which the section becomes functional. */
  phase: number;
  summary: string;
}

const META: Record<GameSectionId, SectionMeta> = {
  inbox: {
    icon: Inbox,
    phase: 3,
    summary: 'Match previews, board messages, transfer offers, injury and scouting reports.',
  },
  squad: {
    icon: Users,
    phase: 1,
    summary: 'Sortable squad tables, custom column views, player cards and profiles.',
  },
  tactics: {
    icon: Shirt,
    phase: 4,
    summary: 'Formation editor, roles and duties, team and player instructions.',
  },
  training: {
    icon: Dumbbell,
    phase: 5,
    summary: 'Weekly schedules, individual focus, intensity and injury risk.',
  },
  transfers: {
    icon: ArrowLeftRight,
    phase: 6,
    summary: 'Transfer market search, shortlists, bids, loans and contract negotiation.',
  },
  scouting: {
    icon: Binoculars,
    phase: 6,
    summary: 'Scout assignments, knowledge levels and scouting reports.',
  },
  finances: {
    icon: Wallet,
    phase: 7,
    summary: 'Income and expenditure, budgets, wages and financial fair play.',
  },
  club: {
    icon: Building2,
    phase: 1,
    summary: 'Board confidence, objectives, staff, facilities and club history.',
  },
  fixtures: {
    icon: CalendarDays,
    phase: 3,
    summary: 'Season calendar, fixtures and results.',
  },
  league: {
    icon: Trophy,
    phase: 1,
    summary: 'League tables, top scorers, assists and ratings.',
  },
  search: {
    icon: Search,
    phase: 1,
    summary: 'Search players, clubs and staff across the world.',
  },
};

export const SECTIONS = GAME_SECTIONS.map((s) => ({ ...s, ...META[s.id] }));
export type Section = (typeof SECTIONS)[number];

export function findSection(id: string | undefined): Section | undefined {
  return SECTIONS.find((s) => s.id === id);
}
