import fs from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

export type Encoding = 'utf8' | 'utf8-bom' | 'latin1';

/**
 * Detect a file's text encoding from its first 64 KB: a UTF-8 BOM, valid UTF-8, or (when the
 * bytes are not valid UTF-8) Latin-1, which many older CSV exports use.
 */
export function detectEncoding(file: string): Encoding {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.subarray(0, n);
    if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return 'utf8-bom';
    // Trim a possibly cut multi-byte character at the end of the sample before validating.
    let end = head.length;
    for (let i = 1; i <= 3 && end - i >= 0; i++) {
      const b = head[end - i]!;
      if ((b & 0xc0) === 0xc0) {
        end -= i;
        break;
      }
      if ((b & 0x80) === 0) break;
    }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(head.subarray(0, end));
      return 'utf8';
    } catch {
      return 'latin1';
    }
  } finally {
    fs.closeSync(fd);
  }
}

export interface CsvReadOptions {
  /** Stop after this many data rows (for inspection). */
  limit?: number;
}

/**
 * Stream a CSV file (RFC 4180: quotes, escaped quotes, embedded newlines) row by row without
 * loading it into memory. Calls `onRow` with each data row keyed by header name.
 * Resolves with the header and the number of data rows read.
 */
export async function streamCsv(
  file: string,
  onRow: (row: Record<string, string>, index: number) => void,
  { limit = Infinity }: CsvReadOptions = {},
): Promise<{ header: string[]; rows: number; encoding: Encoding }> {
  const encoding = detectEncoding(file);
  const decoder = new StringDecoder(encoding === 'latin1' ? 'latin1' : 'utf8');
  const stream = fs.createReadStream(file, { highWaterMark: 1 << 20 });

  let header: string[] | null = null;
  let rows = 0;
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let pendingQuote = false; // saw a quote inside a quoted field; next char decides
  let first = true;
  let done = false;

  const endRow = () => {
    row.push(field);
    field = '';
    const r = row;
    row = [];
    if (r.length === 1 && r[0] === '') return; // blank line
    if (!header) {
      header = r.map((h) => h.trim());
      return;
    }
    if (rows >= limit) {
      done = true;
      return;
    }
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) obj[header[i]!] = r[i] ?? '';
    onRow(obj, rows);
    rows++;
  };

  const feed = (text: string) => {
    for (let i = 0; i < text.length && !done; i++) {
      const ch = text[i]!;
      if (first) {
        first = false;
        if (ch === '﻿') continue;
      }
      if (pendingQuote) {
        pendingQuote = false;
        if (ch === '"') {
          field += '"';
          continue;
        }
        inQuotes = false; // closing quote; fall through to handle ch normally
      }
      if (inQuotes) {
        if (ch === '"') pendingQuote = true;
        else field += ch;
        continue;
      }
      if (ch === '"' && field === '') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        endRow();
      } else if (ch === '\r') {
        // handled by the following \n (or treated as a line break on its own)
        if (text[i + 1] !== '\n') endRow();
      } else {
        field += ch;
      }
    }
  };

  for await (const chunk of stream) {
    feed(decoder.write(chunk as Buffer));
    if (done) {
      stream.destroy();
      break;
    }
  }
  if (!done) {
    feed(decoder.end());
    if (pendingQuote) inQuotes = false;
    if (inQuotes) throw new Error(`${file}: unterminated quoted field`);
    if (field !== '' || row.length) endRow();
  }
  return { header: header ?? [], rows, encoding };
}

/** Read a whole CSV into memory (fine for small tables like clubs or competitions). */
export async function readCsv(
  file: string,
): Promise<{ header: string[]; rows: Record<string, string>[] }> {
  const rows: Record<string, string>[] = [];
  const { header } = await streamCsv(file, (r) => rows.push(r));
  return { header, rows };
}
