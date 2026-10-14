import { Logo } from './Logo';

/** Only used for the initial session check, before any layout can render. */
export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <div className="animate-pulse">
        <Logo size="lg" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
