import { cn } from '@/lib/utils';

export function Logo({ size = 'md', compact = false }: { size?: 'md' | 'lg'; compact?: boolean }) {
  const mark = size === 'lg' ? 'size-9' : 'size-7';
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className={cn(mark, 'shrink-0')} aria-hidden>
        <rect width="32" height="32" rx="7" fill="var(--color-accent)" />
        <path d="M8 9v9a8 8 0 0 0 16 0V9h-4v9a4 4 0 0 1-8 0V9z" fill="#fff" />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-bold tracking-tight', size === 'lg' ? 'text-lg' : 'text-sm')}>
            Ultimate Manager
          </span>
          <span className="mt-0.5 text-2xs font-medium tracking-[0.2em] text-fg-subtle uppercase">
            Road to Glory
          </span>
        </span>
      )}
    </span>
  );
}
