import { Kbd } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useUiStore } from '@/stores/ui-store';
import { SECTIONS } from './sections';

const GENERAL = [
  { keys: ['Space'], label: 'Continue' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
  { keys: ['['], label: 'Collapse / expand sidebar' },
];

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Keyboard shortcuts" className="max-w-lg">
        <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {[
            ...GENERAL,
            ...SECTIONS.map((s) => ({ keys: ['g', s.shortcut], label: `Go to ${s.label}` })),
          ].map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between gap-3 py-0.5 text-sm">
              <span className="text-fg-muted">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
