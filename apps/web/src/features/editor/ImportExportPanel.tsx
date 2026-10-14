import type { ImportEntity, WorldImportResult } from '@um/shared';
import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/api';
import { downloadExport, useImportWorld } from '../world/api';

/** Export clubs/players as JSON or CSV, edit them anywhere, and import the changes back. */
export function ImportExportPanel({ saveId }: { saveId: string }) {
  const importWorld = useImportWorld(saveId);
  const [entity, setEntity] = useState<ImportEntity>('clubs');
  const [result, setResult] = useState<WorldImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportFile = (e: ImportEntity, format: 'json' | 'csv') =>
    downloadExport(saveId, e, format).catch((err: unknown) => toast.error(errorMessage(err)));

  async function onFile(file: File) {
    const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
    const content = await file.text();
    importWorld.mutate(
      { entity, format, content },
      {
        onSuccess: (r) => {
          setResult(r);
          toast.success(`Imported ${r.updated} ${entity}`);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-fg-muted">
            Download clubs or players to edit in a spreadsheet or text editor. Keep the{' '}
            <code>id</code> column so the changes can be matched on import.
          </p>
          {(['clubs', 'players'] as const).map((e) => (
            <div key={e} className="flex items-center gap-2">
              <span className="w-16 capitalize">{e}</span>
              <Button size="sm" onClick={() => void exportFile(e, 'csv')}>
                <Download /> CSV
              </Button>
              <Button size="sm" onClick={() => void exportFile(e, 'json')}>
                <Download /> JSON
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Import</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-fg-muted">
            Clubs: name, shortName, code, city, colours. Players: names, potential (<code>pa</code>)
            and any attribute columns. Only the columns you include are changed; ability and value
            are recalculated.
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="import-entity" className="text-xs text-fg-muted">
              Import
            </label>
            <select
              id="import-entity"
              value={entity}
              onChange={(e) => setEntity(e.target.value as ImportEntity)}
              className="h-8 rounded-md border border-border bg-surface-2 px-2"
            >
              <option value="clubs">Clubs</option>
              <option value="players">Players</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              aria-label="Choose a file to import"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="primary"
              size="sm"
              loading={importWorld.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload /> Choose file…
            </Button>
          </div>
          {result && (
            <div role="status" className="rounded-md border border-border bg-surface-2 p-3 text-xs">
              <p>
                Updated <strong>{result.updated}</strong> {entity}.
                {result.errors.length > 0 && ` ${result.errors.length} row(s) skipped:`}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-4 text-warning">
                  {result.errors.slice(0, 50).map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
