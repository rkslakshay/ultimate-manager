import type { SaveGameDto } from '@um/shared';
import { Construction } from 'lucide-react';
import { Navigate, useOutletContext, useParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatGameDate } from '@/lib/format';
import { findSection } from './sections';

/**
 * Routed placeholder for game sections that aren't built yet. It says plainly which phase
 * delivers the section rather than pretending to be finished.
 */
export function SectionPage() {
  const { section: sectionId } = useParams();
  const save = useOutletContext<SaveGameDto>();
  const section = findSection(sectionId);
  if (!section) return <Navigate to={`/game/${save.id}/inbox`} replace />;
  const Icon = section.icon;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-accent-text" aria-hidden />
        <h2 className="text-lg font-semibold">{section.label}</h2>
        <Badge tone="warning">Phase {section.phase}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start gap-3">
            <Construction className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-sm">{section.summary}</p>
              <p className="mt-2 text-xs text-fg-muted">
                This screen is a placeholder. It becomes functional in Phase {section.phase} of the
                build plan.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Career</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-muted">Manager</dt>
              <dd>{save.managerName}</dd>
              <dt className="text-fg-muted">Club</dt>
              <dd>{save.clubName ?? 'Unemployed'}</dd>
              <dt className="text-fg-muted">Date</dt>
              <dd className="tabular">{formatGameDate(save.gameDate)}</dd>
              <dt className="text-fg-muted">World seed</dt>
              <dd className="truncate font-mono text-xs">{save.seed}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
