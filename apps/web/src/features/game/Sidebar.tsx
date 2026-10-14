import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router';
import { Logo } from '@/components/Logo';
import { Kbd } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';
import { SECTIONS } from './sections';

export function Sidebar({ saveId }: { saveId: string }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150',
        collapsed ? 'w-(--sidebar-width-collapsed)' : 'w-(--sidebar-width)',
      )}
    >
      <div className="flex h-(--topbar-height) items-center border-b border-border px-3">
        <Logo compact={collapsed} />
      </div>

      <nav aria-label="Game sections" className="flex-1 overflow-y-auto py-2">
        <ul className="flex flex-col gap-0.5 px-2">
          {SECTIONS.map(({ id, label, icon: Icon, shortcut }) => (
            <li key={id}>
              <NavLink
                to={`/game/${saveId}/${id}`}
                title={collapsed ? `${label} (g then ${shortcut})` : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg',
                    isActive &&
                      'bg-accent-muted text-fg shadow-[inset_2px_0_0_var(--color-accent)] hover:bg-accent-muted',
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {collapsed && <span className="sr-only">{label}</span>}
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    <Kbd
                      aria-hidden
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {shortcut}
                    </Kbd>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        onClick={toggle}
        className="flex h-9 items-center gap-2.5 border-t border-border px-4 text-xs text-fg-subtle transition-colors hover:text-fg"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <>
            <PanelLeftClose className="size-4" /> Collapse
          </>
        )}
      </button>
    </aside>
  );
}
