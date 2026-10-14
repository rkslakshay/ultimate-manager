import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Kbd } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { attributeClass } from '@/lib/utils';

/** Demo rows for the table showcase only: invented names, not game data. */
interface DemoPlayer {
  name: string;
  position: string;
  age: number;
  finishing: number;
  passing: number;
  pace: number;
  value: number;
}

const DEMO_PLAYERS: DemoPlayer[] = [
  {
    name: 'Tomas Varga',
    position: 'ST',
    age: 24,
    finishing: 17,
    passing: 11,
    pace: 15,
    value: 18_500_000,
  },
  {
    name: 'Elio Brandt',
    position: 'AM',
    age: 21,
    finishing: 12,
    passing: 16,
    pace: 13,
    value: 9_200_000,
  },
  {
    name: 'Kofi Mensah',
    position: 'DM',
    age: 29,
    finishing: 7,
    passing: 14,
    pace: 11,
    value: 4_100_000,
  },
  {
    name: 'Ruben Okafor',
    position: 'CB',
    age: 31,
    finishing: 4,
    passing: 10,
    pace: 9,
    value: 1_800_000,
  },
  {
    name: 'Lars Eklund',
    position: 'GK',
    age: 27,
    finishing: 2,
    passing: 8,
    pace: 6,
    value: 3_300_000,
  },
  {
    name: 'Matteo Rinaldi',
    position: 'RW',
    age: 19,
    finishing: 13,
    passing: 12,
    pace: 19,
    value: 12_000_000,
  },
];

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const attrCell = (value: number) => (
  <span className={`font-semibold ${attributeClass(value)}`}>{value}</span>
);

const columns: ColumnDef<DemoPlayer>[] = [
  { accessorKey: 'name', header: 'Name', enableHiding: false },
  { accessorKey: 'position', header: 'Pos' },
  { accessorKey: 'age', header: 'Age', meta: { align: 'right' } },
  {
    accessorKey: 'finishing',
    header: 'Fin',
    meta: { align: 'right', label: 'Finishing' },
    cell: (c) => attrCell(c.getValue<number>()),
  },
  {
    accessorKey: 'passing',
    header: 'Pas',
    meta: { align: 'right', label: 'Passing' },
    cell: (c) => attrCell(c.getValue<number>()),
  },
  {
    accessorKey: 'pace',
    header: 'Pac',
    meta: { align: 'right', label: 'Pace' },
    cell: (c) => attrCell(c.getValue<number>()),
  },
  {
    accessorKey: 'value',
    header: 'Value',
    meta: { align: 'right' },
    cell: (c) => money.format(c.getValue<number>()),
  },
];

const SWATCHES = [
  'bg',
  'surface',
  'surface-2',
  'surface-3',
  'border',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
] as const;

export function UiKitPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <p className="text-sm text-fg-muted">
        The shared component library and design tokens (see <code>docs/DESIGN_SYSTEM.md</code>).
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Colour tokens</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {SWATCHES.map((name) => (
            <div key={name} className="flex w-20 flex-col gap-1">
              <div
                className="h-10 rounded-md border border-border-strong"
                style={{ background: `var(--color-${name})` }}
              />
              <span className="font-mono text-2xs text-fg-muted">{name}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3">
              {[3, 7, 11, 14, 18].map((v) => (
                <span key={v} className={`font-semibold ${attributeClass(v)}`}>
                  {v}
                </span>
              ))}
            </div>
            <span className="font-mono text-2xs text-fg-muted">attribute ramp (1-20)</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buttons &amp; badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">
                <Plus /> Primary
              </Button>
              <Button>Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">
                <Trash2 /> Danger
              </Button>
              <Button variant="primary" loading>
                Saving
              </Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Key player</Badge>
              <Badge tone="success">Fit</Badge>
              <Badge tone="warning">Unhappy</Badge>
              <Badge tone="danger">Injured</Badge>
              <Badge tone="info">On loan</Badge>
              <Kbd>g</Kbd>
              <Kbd>Space</Kbd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form, modal &amp; toast</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FormField label="Player name" hint="Hints sit under the field.">
              {(field) => <Input {...field} placeholder="Search players…" />}
            </FormField>
            <FormField label="Invalid field" error="Errors are announced to screen readers.">
              {(field) => <Input {...field} defaultValue="???" />}
            </FormField>
          </CardContent>
          <CardFooter>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Open modal</Button>
              </DialogTrigger>
              <DialogContent
                title="Confirm bid"
                description="Modals trap focus and close on Escape."
              >
                <p className="text-sm text-fg-muted">Submit a €4.5M bid for this player?</p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="primary" onClick={() => toast.success('Bid submitted (demo)')}>
                      Submit bid
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" onClick={() => toast('Inbox: new message (demo)')}>
              Show toast
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabs &amp; data table</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="loading">Loading</TabsTrigger>
              <TabsTrigger value="empty">Empty</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <DataTable
                caption="Demo players"
                columns={columns}
                data={DEMO_PLAYERS}
                searchable
                columnPicker
                searchPlaceholder="Filter players…"
                initialSorting={[{ id: 'value', desc: true }]}
                pageSize={5}
              />
            </TabsContent>
            <TabsContent value="loading">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-1/3" />
                <DataTable caption="Loading demo" columns={columns} data={[]} isLoading />
              </div>
            </TabsContent>
            <TabsContent value="empty">
              <DataTable
                caption="Empty demo"
                columns={columns}
                data={[]}
                emptyMessage="No players match your filters."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
