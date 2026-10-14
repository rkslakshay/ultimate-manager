import type { SaveGameDto } from '@um/shared';
import {
  CalendarDays,
  ChevronRight,
  Database,
  Keyboard,
  LogOut,
  Palette,
  Save,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Kbd } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClubBadge } from '@/components/game/ClubBadge';
import { formatGameDate } from '@/lib/format';
import { useUiStore } from '@/stores/ui-store';
import { useLogout, useMe } from '../auth/api';
import { useClub } from '../world/api';

interface TopBarProps {
  save: SaveGameDto;
  title: string;
  onContinue: () => void;
}

export function TopBar({ save, title, onContinue }: TopBarProps) {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const club = useClub(save.id, save.managerClubId);
  const clubName = save.clubName ?? 'Unemployed';

  return (
    <header className="flex h-(--topbar-height) shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {club.data ? (
          <ClubBadge club={club.data} size="md" />
        ) : (
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-3 text-2xs font-bold text-fg-muted"
            aria-hidden
          >
            —
          </div>
        )}
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">{clubName}</span>
          <span className="truncate text-2xs text-fg-subtle">
            {save.managerName} · {save.name}
          </span>
        </div>
        <ChevronRight className="hidden size-4 shrink-0 text-fg-subtle md:block" aria-hidden />
        <h1 className="hidden truncate text-sm font-medium text-fg-muted md:block">{title}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="hidden items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs sm:flex"
          aria-label="Current in-game date"
        >
          <CalendarDays className="size-3.5 text-fg-subtle" aria-hidden />
          <time dateTime={save.gameDate} className="tabular font-medium">
            {formatGameDate(save.gameDate)}
          </time>
        </div>

        <Button variant="primary" onClick={onContinue} className="gap-2 px-4">
          Continue <Kbd className="border-white/30 bg-white/15 text-white">Space</Kbd>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <UserRound />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{user?.displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/saves">
                <Save /> Switch save
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
              <Keyboard /> Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/game/${save.id}/editor`}>
                <Database /> Database editor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/game/${save.id}/ui-kit`}>
                <Palette /> UI kit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                logout.mutate(undefined, { onSettled: () => void navigate('/login') })
              }
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
