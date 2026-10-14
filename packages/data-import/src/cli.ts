#!/usr/bin/env node
/**
 * Data pack CLI.
 *   npm run data:inspect                    inventory data-packs/raw (columns, rows, encodings)
 *   npm run data:import -- --pack real      build the real pack from data-packs/raw
 *   npm run data:import -- --pack real --dry-run   validate and report only
 *   npm run data:import -- --pack sample    build the pack from the committed fictional fixtures
 */
import fs from 'node:fs';
import path from 'node:path';
import { inspectRaw, inventoryMarkdown } from './inspect';
import { packPaths } from './paths';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function inspect() {
  const paths = packPaths();
  const items = await inspectRaw(paths.raw);
  fs.mkdirSync(paths.reports, { recursive: true });
  const base = path.join(paths.reports, `inspect-${stamp()}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(items, null, 2));
  fs.writeFileSync(`${base}.md`, inventoryMarkdown(items, paths.raw));
  if (!items.length) {
    console.log(`No files in ${paths.raw}. See data-packs/README.md for what to put there.`);
  } else {
    for (const f of items) {
      const status = f.missingRequired?.length
        ? `MISSING ${f.missingRequired.join(', ')}`
        : (f.table ?? f.kind);
      console.log(
        `${f.path.padEnd(48)} ${String(f.rows ?? '').padStart(9)} rows  ${status}${f.note ? `  (${f.note})` : ''}`,
      );
    }
  }
  console.log(`Report: ${path.relative(process.cwd(), base)}.md`);
}

async function main() {
  const command = process.argv[2];
  if (command === 'inspect') return inspect();
  if (command === 'import') {
    const { runImport } = await import('./run-import');
    const pack = arg('pack') ?? 'real';
    const ok = await runImport({ pack, dryRun: flag('dry-run') });
    process.exitCode = ok ? 0 : 1;
    return;
  }
  console.error('Usage: cli <inspect|import> [--pack real|sample] [--dry-run]');
  process.exitCode = 2;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
