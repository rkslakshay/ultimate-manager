import type { HistoricalTransferDto } from '@um/shared';
import { Link } from 'react-router';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import { money, moneyFull } from '@/lib/game-format';
import { usePlayerHistory } from './api';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

/** How a fee is shown: unknown fees stay unknown; a reported €0 is labelled as reported. */
function Fee({ t }: { t: HistoricalTransferDto }) {
  if (t.type?.toLowerCase().includes('loan')) return <Badge tone="info">Loan</Badge>;
  if (t.feeStatus === 'paid' && t.feeEur !== null) return <span>{moneyFull(t.feeEur)}</span>;
  if (t.feeStatus === 'zero_reported')
    return (
      <span title="The source reports a fee of 0, usually a free transfer">
        €0 / free (as reported)
      </span>
    );
  return (
    <span className="text-fg-subtle" title="The source does not report a fee">
      Undisclosed / unknown
    </span>
  );
}

function ClubCell({ saveId, club }: { saveId: string; club: HistoricalTransferDto['fromClub'] }) {
  if (!club.name) return <span className="text-fg-subtle">Unknown</span>;
  return club.id ? (
    <Link to={`/game/${saveId}/clubs/${club.id}`} className="hover:underline">
      {club.name}
    </Link>
  ) : (
    <span>{club.name}</span>
  );
}

/** Real-world transfer and market-value history from the save's data pack. */
export function PlayerHistory({ saveId, playerId }: { saveId: string; playerId: number }) {
  const history = usePlayerHistory(saveId, playerId);
  if (history.isPending) return <Skeleton className="h-48 w-full" />;
  if (history.isError)
    return (
      <p role="alert" className="text-sm text-danger">
        {errorMessage(history.error)}
      </p>
    );
  const { transfers, valuations } = history.data;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Market value history</CardTitle>
          <Badge tone="success" title="From the imported data pack, with dates">
            real-world data
          </Badge>
        </CardHeader>
        <CardContent>
          {valuations.length ? (
            <div
              className="h-48"
              role="img"
              aria-label={`Market value from ${fmtDate(valuations[0]!.date)} to ${fmtDate(valuations.at(-1)!.date)}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={valuations} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(0, 7)}
                    stroke="var(--color-fg-subtle)"
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={(v: number) => money(v)}
                    stroke="var(--color-fg-subtle)"
                    fontSize={11}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v) => [moneyFull(Number(v)), 'Value']}
                    labelFormatter={(d) => fmtDate(String(d))}
                    contentStyle={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border-strong)',
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="valueEur"
                    stroke="var(--color-accent-text)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-fg-subtle">
              No market value history in the data for this player.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transfer history</CardTitle>
          <Badge
            tone="success"
            title="Historical transfers from the data pack; in-game transfers will be listed separately"
          >
            historical
          </Badge>
        </CardHeader>
        <CardContent>
          {transfers.length ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Historical transfers</caption>
              <thead>
                <tr className="text-left text-2xs uppercase tracking-wide text-fg-subtle">
                  <th scope="col" className="pb-1.5">
                    Date
                  </th>
                  <th scope="col" className="pb-1.5">
                    From
                  </th>
                  <th scope="col" className="pb-1.5">
                    To
                  </th>
                  <th scope="col" className="pb-1.5 text-right">
                    Fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={`${t.date}-${i}`} className="border-t border-border/60">
                    <td className="py-1.5 whitespace-nowrap tabular">{fmtDate(t.date)}</td>
                    <td className="py-1.5">
                      <ClubCell saveId={saveId} club={t.fromClub} />
                    </td>
                    <td className="py-1.5">
                      <ClubCell saveId={saveId} club={t.toClub} />
                    </td>
                    <td className="py-1.5 text-right">
                      <Fee t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-fg-subtle">
              No transfers recorded in the data for this player.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
