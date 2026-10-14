import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, errorMessage } from '@/lib/api';
import { useLoadSave, useSave } from '../saves/api';
import { findSection } from './sections';
import { ShortcutsDialog } from './ShortcutsDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useGameShortcuts } from './useGameShortcuts';

export function GameLayout() {
  const { saveId = '' } = useParams();
  const location = useLocation();
  const save = useSave(saveId);
  const loadSave = useLoadSave();
  const markedLoaded = useRef<string | null>(null);

  // Record "last played" once per opened save.
  const { mutate: markLoaded } = loadSave;
  useEffect(() => {
    if (save.data && markedLoaded.current !== saveId) {
      markedLoaded.current = saveId;
      markLoaded(saveId);
    }
  }, [save.data, saveId, markLoaded]);

  const onContinue = useCallback(() => {
    // TODO(phase-3): advance the calendar to the next event that needs attention.
    toast.info('Time advancement arrives with the season loop (Phase 3).', {
      id: 'continue-placeholder',
    });
  }, []);
  useGameShortcuts(saveId, onContinue);

  const segment = location.pathname.split('/')[3];
  const title = segment === 'ui-kit' ? 'UI Kit' : (findSection(segment)?.label ?? '');

  if (save.isError) {
    const notFound = save.error instanceof ApiError && save.error.status === 404;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">
          {notFound ? 'Save game not found' : 'Could not load save'}
        </h1>
        <p className="text-sm text-fg-muted">
          {notFound ? 'It may have been deleted.' : errorMessage(save.error)}
        </p>
        <Button asChild>
          <Link to="/saves">
            <ArrowLeft /> Back to saves
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar saveId={saveId} />
      <div className="flex min-w-0 flex-1 flex-col">
        {save.data ? (
          <TopBar save={save.data} title={title} onContinue={onContinue} />
        ) : (
          <div className="flex h-(--topbar-height) items-center gap-3 border-b border-border bg-surface px-4">
            <Skeleton className="size-8" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-8 w-28" />
          </div>
        )}
        <main id="main" className="flex-1 overflow-y-auto p-4 sm:p-5">
          {save.data ? <Outlet context={save.data} /> : <Skeleton className="h-64 w-full" />}
        </main>
      </div>
      <ShortcutsDialog />
    </div>
  );
}
