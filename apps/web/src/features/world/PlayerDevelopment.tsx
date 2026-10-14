import { ATTRIBUTE_LABELS, type AttributeKey } from '@um/engine';
import type { AttributeChangeDto } from '@um/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import { usePlayerDevelopment } from './api';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Attribute changes from progression reviews, newest first, grouped by review. */
export function PlayerDevelopment({ saveId, playerId }: { saveId: string; playerId: number }) {
  const dev = usePlayerDevelopment(saveId, playerId);
  const groups = new Map<string, AttributeChangeDto[]>();
  for (const c of dev.data?.changes ?? []) groups.set(c.date, [...(groups.get(c.date) ?? []), c]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Development</CardTitle>
      </CardHeader>
      <CardContent>
        {dev.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : dev.isError ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(dev.error)}
          </p>
        ) : groups.size === 0 ? (
          <p className="text-sm text-fg-subtle">
            No development recorded yet. Players grow and decline as time passes; that starts once
            the season loop arrives (Phase 3).
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {[...groups.entries()].map(([date, changes]) => (
              <li key={date}>
                <p className="mb-1 text-xs text-fg-muted">
                  {dateFmt.format(new Date(`${date}T00:00:00Z`))} ·{' '}
                  {changes[0]!.period === 'season' ? 'Season review' : 'Monthly review'} · ability{' '}
                  {changes[0]!.caBefore} → {changes[0]!.caAfter}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {changes.map((c) => {
                    const up = c.to > c.from;
                    return (
                      <li
                        key={c.attribute}
                        className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs ${up ? 'border-success/40 text-success' : 'border-danger/40 text-danger'}`}
                        title={
                          c.reason === 'training' ? 'From individual training focus' : undefined
                        }
                      >
                        {up ? (
                          <ArrowUp className="size-3" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3" aria-hidden />
                        )}
                        {ATTRIBUTE_LABELS[c.attribute as AttributeKey] ?? c.attribute} {c.from} →{' '}
                        {c.to}
                        <span className="sr-only">{up ? 'improved' : 'declined'}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
