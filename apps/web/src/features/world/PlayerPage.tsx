import {
  A,
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_LABELS,
  allPositionRatings,
  POSITION_LABELS,
  POSITIONS,
  TRAITS,
  type AttributeGroup,
  type TraitId,
} from '@um/engine';
import type { PlayerDetailDto } from '@um/shared';
import { Link, useParams } from 'react-router';
import { ClubBadge } from '@/components/game/ClubBadge';
import { PositionsMap } from '@/components/game/PositionsMap';
import { ProvenanceTag } from '@/components/game/ProvenanceTag';
import { Stars } from '@/components/game/Stars';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import {
  contractEnd,
  familiarityLabel,
  fullName,
  money,
  moneyFull,
  SQUAD_STATUS_LABELS,
  wage,
} from '@/lib/game-format';
import { attributeClass, cn } from '@/lib/utils';
import { useGameSave } from '../game/useGameSave';
import { usePlayer } from './api';
import { PlayerHistory } from './PlayerHistory';

const GROUP_TITLES: Record<AttributeGroup, string> = {
  technical: 'Technical',
  mental: 'Mental',
  physical: 'Physical',
  goalkeeping: 'Goalkeeping',
};

const ORIGIN_NOTE: Record<string, string> = {
  D: 'Derived: the source data has no equivalent, so the game estimated it',
  F: 'From a coarse source rating (detailed rating missing)',
};

function AttributeColumn({
  group,
  attributes,
  origin,
}: {
  group: AttributeGroup;
  attributes: number[];
  /** Per-attribute origin string (S/F/D) for imported players. */
  origin?: string;
}) {
  return (
    <section aria-labelledby={`attr-${group}`}>
      <h3
        id={`attr-${group}`}
        className="mb-1.5 text-2xs font-semibold tracking-wide text-fg-subtle uppercase"
      >
        {GROUP_TITLES[group]}
      </h3>
      <dl className="flex flex-col">
        {ATTRIBUTE_GROUPS[group].map((key) => {
          const value = attributes[A[key]] ?? 1;
          const note = origin ? ORIGIN_NOTE[origin[A[key]] ?? 'S'] : undefined;
          return (
            <div
              key={key}
              className="flex items-center justify-between border-b border-border/60 py-1 text-sm last:border-0"
            >
              <dt className="text-fg-muted">{ATTRIBUTE_LABELS[key]}</dt>
              <dd
                className={cn(
                  'tabular w-6 text-right font-semibold',
                  attributeClass(value),
                  note && 'underline decoration-dotted decoration-fg-subtle underline-offset-4',
                )}
                title={note}
              >
                {value}
                {note && <span className="sr-only"> ({note})</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="tabular">{children}</dd>
    </>
  );
}

function PlayerHeader({ player }: { player: PlayerDetailDto }) {
  const save = useGameSave();
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
      {player.club ? (
        <ClubBadge club={player.club} size="lg" />
      ) : (
        <div className="size-14 rounded-md border border-dashed border-border-strong" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-xl font-semibold">
            {player.shirtNumber !== null && (
              <span className="mr-2 text-fg-subtle">{player.shirtNumber}</span>
            )}
            {fullName(player)}
          </h2>
          {player.origin === 'imported' && (
            <Badge tone="success" title="Identity and most data come from the imported data pack">
              Real player
            </Badge>
          )}
          {player.origin === 'generated' && player.source === null && (
            <Badge title="Created by the game, not a real person">Generated</Badge>
          )}
          {player.origin === 'custom' && (
            <Badge tone="accent" title="Added in the database editor">
              Custom
            </Badge>
          )}
        </div>
        <p className="text-sm text-fg-muted">
          {POSITION_LABELS[player.position as keyof typeof POSITION_LABELS]} · {player.age} years ·{' '}
          {player.nation.name} ·{' '}
          {player.club ? (
            <Link className="hover:underline" to={`/game/${save.id}/clubs/${player.club.id}`}>
              {player.club.name}
            </Link>
          ) : (
            'Free agent'
          )}
        </p>
      </div>
      <div className="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span>Ability</span>
        <Stars ability={player.ca} label="Current ability" />
        <span>Potential</span>
        <Stars ability={player.pa} label="Potential" />
      </div>
    </div>
  );
}

export function PlayerPage() {
  const save = useGameSave();
  const playerId = Number(useParams().playerId);
  const query = usePlayer(save.id, playerId);

  if (query.isError)
    return (
      <p role="alert" className="text-danger">
        {errorMessage(query.error)}
      </p>
    );
  if (!query.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  const p = query.data;
  const isGk = p.position === 'GK';
  const groups: AttributeGroup[] = isGk
    ? ['goalkeeping', 'mental', 'physical']
    : ['technical', 'mental', 'physical'];
  const ratings = allPositionRatings(p.attributes, p.positions)
    .map((rating, i) => ({ pos: POSITIONS[i]!, rating, familiarity: p.positions[i] ?? 1 }))
    .filter((r) => r.familiarity >= 10 && (isGk ? r.pos === 'GK' : r.pos !== 'GK'))
    .sort((a, b) => b.rating - a.rating);

  return (
    <div className="flex flex-col gap-4">
      <PlayerHeader player={p} />
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Attributes</CardTitle>
            {p.source && (
              <span className="text-2xs text-fg-subtle">
                <span className="underline decoration-dotted underline-offset-4">Dotted</span> =
                derived, not in the source
              </span>
            )}
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            {groups.map((g) => (
              <AttributeColumn
                key={g}
                group={g}
                attributes={p.attributes}
                origin={p.source?.attributeOrigin}
              />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Positions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <PositionsMap positions={p.positions} />
            <table className="w-full text-sm">
              <caption className="sr-only">Position ratings</caption>
              <tbody>
                {ratings.slice(0, 5).map((r) => (
                  <tr key={r.pos} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-1 text-left font-normal text-fg-muted">
                      {POSITION_LABELS[r.pos]}
                    </th>
                    <td className="text-2xs text-fg-subtle">{familiarityLabel(r.familiarity)}</td>
                    <td
                      className={cn(
                        'tabular w-10 text-right font-semibold',
                        attributeClass(r.rating),
                      )}
                    >
                      {r.rating.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Info label="Born">
                {p.birthDate} ({p.age})
                <ProvenanceTag status={p.source?.fields.birthDay} />
              </Info>
              <Info label="Nationality">
                {p.nation.name}
                <ProvenanceTag status={p.source?.fields.nationality} />
              </Info>
              <Info label="Height">
                {p.heightCm} cm
                <ProvenanceTag status={p.source?.fields.height} />
              </Info>
              <Info label="Weight">
                {p.weightKg} kg
                <ProvenanceTag status={p.source?.fields.weight} />
              </Info>
              <Info label="Preferred foot">
                {p.foot === 'either' ? 'Either' : p.foot === 'left' ? 'Left' : 'Right'}
                {p.foot !== 'either' && (
                  <span className="text-fg-subtle"> (weaker foot {p.weakFoot}/20)</span>
                )}
              </Info>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contract</CardTitle>
          </CardHeader>
          <CardContent>
            {p.club ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Info label="Wage">
                  {wage(p.wage)}
                  <ProvenanceTag status={p.source?.fields.wage} />
                </Info>
                <Info label="Expires">
                  {contractEnd(p.contractEnd)}
                  <ProvenanceTag status={p.source?.fields.contractEnd} />
                </Info>
                <Info label="Squad status">{SQUAD_STATUS_LABELS[p.squadStatus ?? ''] ?? '—'}</Info>
                <Info label="Release clause">
                  {p.releaseClause
                    ? moneyFull(p.releaseClause)
                    : p.source?.fields.releaseClause === 'unknown'
                      ? 'Unknown'
                      : 'None'}
                  {p.releaseClause !== null && (
                    <ProvenanceTag status={p.source?.fields.releaseClause} />
                  )}
                </Info>
                <Info label="Value">
                  {money(p.value)}
                  <ProvenanceTag status={p.source?.fields.value} />
                </Info>
              </dl>
            ) : (
              <p className="text-sm text-fg-muted">
                Free agent · estimated value {money(p.value)}. Signing players arrives in Phase 6.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Player traits</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {p.traits.length ? (
              p.traits.map((t) => (
                <Badge key={t} tone="info">
                  {TRAITS[t as TraitId] ?? t}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-fg-subtle">No notable traits.</p>
            )}
          </CardContent>
        </Card>
      </div>
      {p.source && (
        <Card>
          <CardHeader>
            <CardTitle>Source data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              Source ratings: overall <strong>{p.source.overall ?? '?'}</strong> · potential{' '}
              <strong>{p.source.potential ?? '?'}</strong> (0-99, as given). The game maps them onto
              its own attributes; Current and Potential Ability are computed by the game, not
              copied.
            </p>
            <p className="text-xs text-fg-muted">
              {[...p.source.attributeOrigin].filter((c) => c === 'S').length} attributes from
              detailed source ratings ·{' '}
              {[...p.source.attributeOrigin].filter((c) => c === 'F').length} from coarse ratings ·{' '}
              {[...p.source.attributeOrigin].filter((c) => c === 'D').length} derived. Hidden
              attributes (consistency, injury proneness, personality…) are derived. Source key{' '}
              <code>{p.source.key}</code>.
            </p>
          </CardContent>
        </Card>
      )}
      {p.origin === 'imported' && <PlayerHistory saveId={save.id} playerId={p.id} />}
    </div>
  );
}
