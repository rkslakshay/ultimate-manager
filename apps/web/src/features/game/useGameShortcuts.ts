import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useUiStore } from '@/stores/ui-store';
import { SECTIONS } from './sections';

const CHORD_TIMEOUT_MS = 1200;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.getAttribute('role') === 'textbox'
  );
}

/**
 * Global game shortcuts:
 *   g then <key>  jump to a section (keys listed in the sidebar)
 *   Space         Continue (when focus isn't on a control)
 *   ?             show the shortcut list
 *   [             toggle the sidebar
 */
export function useGameShortcuts(saveId: string, onContinue: () => void) {
  const navigate = useNavigate();
  const pendingG = useRef<number | null>(null);
  const continueRef = useRef(onContinue);
  useEffect(() => {
    continueRef.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    const clearChord = () => {
      if (pendingG.current !== null) window.clearTimeout(pendingG.current);
      pendingG.current = null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      // Ignore keys while a modal/menu is open.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;

      if (pendingG.current !== null) {
        const section = SECTIONS.find((s) => s.shortcut === e.key.toLowerCase());
        clearChord();
        if (section) {
          e.preventDefault();
          void navigate(`/game/${saveId}/${section.id}`);
        }
        return;
      }

      if (e.key === 'g') {
        pendingG.current = window.setTimeout(clearChord, CHORD_TIMEOUT_MS);
      } else if (e.key === '?') {
        useUiStore.getState().setShortcutsOpen(true);
      } else if (e.key === '[') {
        useUiStore.getState().toggleSidebar();
      } else if (e.key === ' ') {
        const target = e.target as HTMLElement | null;
        // Space activates buttons/tabs/checkboxes natively; links don't use it, so allow those.
        const spaceControls = 'button, summary, [role="button"], [role="tab"], [role="checkbox"]';
        if (target && target.closest(spaceControls)) return;
        e.preventDefault();
        continueRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearChord();
    };
  }, [navigate, saveId]);
}
