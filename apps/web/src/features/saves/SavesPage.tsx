import type { SaveGameDto } from '@um/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { LogOut, MoreHorizontal, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { errorMessage } from '@/lib/api';
import { formatGameDate, formatRelative } from '@/lib/format';
import { useLogout, useMe } from '../auth/api';
import { useSaves } from './api';
import { CreateSaveDialog } from './CreateSaveDialog';
import { DeleteSaveDialog, RenameSaveDialog } from './SaveActionsDialogs';

export function SavesPage() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();
  const saves = useSaves();
  const [renaming, setRenaming] = useState<SaveGameDto | null>(null);
  const [deleting, setDeleting] = useState<SaveGameDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const items = saves.data?.items ?? [];
  const limit = saves.data?.limit ?? 10;
  const atLimit = items.length >= limit;

  const columns = useMemo<ColumnDef<SaveGameDto>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Save',
        cell: ({ row }) => <span className="font-medium text-fg">{row.original.name}</span>,
      },
      { accessorKey: 'managerName', header: 'Manager' },
      {
        accessorKey: 'dataPack',
        header: 'World',
        cell: ({ getValue }) =>
          getValue<string>() === 'fictional' ? (
            'Fictional'
          ) : (
            <Badge tone="success">{getValue<string>()}</Badge>
          ),
      },
      {
        accessorKey: 'clubName',
        header: 'Club',
        cell: ({ getValue }) =>
          getValue<string | null>() ?? <span className="text-fg-subtle">Unemployed</span>,
      },
      {
        accessorKey: 'gameDate',
        header: 'In-game date',
        cell: ({ getValue }) => formatGameDate(getValue<string>()),
      },
      {
        accessorKey: 'lastPlayedAt',
        header: 'Last played',
        cell: ({ getValue }) => (
          <span className="text-fg-muted">{formatRelative(getValue<string>())}</span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button asChild size="sm" variant="primary">
              <Link to={`/game/${row.original.id}/inbox`}>
                <Play /> Load
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`More actions for ${row.original.name}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setRenaming(row.original)}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-danger"
                  onSelect={() => setDeleting(row.original)}
                >
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="min-h-dvh">
      <header className="flex h-(--topbar-height) items-center justify-between border-b border-border bg-surface px-4">
        <Logo />
        <div className="flex items-center gap-3 text-xs text-fg-muted">
          <span>
            Signed in as <span className="text-fg">{user?.displayName}</span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            loading={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => void navigate('/login') })}
          >
            <LogOut /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Careers</CardTitle>
              <Badge tone={atLimit ? 'warning' : 'neutral'}>
                {items.length}/{limit}
              </Badge>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="primary" disabled={atLimit || saves.isPending}>
                  <Plus /> New career
                </Button>
              </DialogTrigger>
              {createOpen && <CreateSaveDialog defaultManagerName={user?.displayName ?? ''} />}
            </Dialog>
          </CardHeader>
          <CardContent>
            {saves.isError ? (
              <p role="alert" className="text-sm text-danger">
                Couldn't load your saves: {errorMessage(saves.error)}
              </p>
            ) : (
              <DataTable
                caption="Your save games"
                columns={columns}
                data={items}
                isLoading={saves.isPending}
                getRowId={(s) => s.id}
                onRowClick={(s) => void navigate(`/game/${s.id}/inbox`)}
                emptyMessage="No careers yet. Start one with “New career”."
              />
            )}
            {atLimit && (
              <p className="mt-3 text-xs text-warning">
                You've reached the save limit. Delete a save to start a new career.
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <RenameSaveDialog
        key={renaming?.id ?? 'none'}
        save={renaming}
        onClose={() => setRenaming(null)}
      />
      <DeleteSaveDialog save={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
