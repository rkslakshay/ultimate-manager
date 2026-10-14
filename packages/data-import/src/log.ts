/** Collects warnings, rejections and counters for the data-quality report. */
export interface LogEntry {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  file?: string;
  row?: number;
}

export class ImportLog {
  readonly entries: LogEntry[] = [];
  readonly counts = new Map<string, number>();
  /** Keep at most this many entries per code (counts stay exact). */
  private readonly perCodeLimit = 200;
  private readonly perCode = new Map<string, number>();

  add(
    level: LogEntry['level'],
    code: string,
    message: string,
    where: { file?: string; row?: number } = {},
  ) {
    this.count(code);
    const n = (this.perCode.get(code) ?? 0) + 1;
    this.perCode.set(code, n);
    if (n <= this.perCodeLimit) this.entries.push({ level, code, message, ...where });
  }
  error(code: string, message: string, where?: { file?: string; row?: number }) {
    this.add('error', code, message, where);
  }
  warn(code: string, message: string, where?: { file?: string; row?: number }) {
    this.add('warning', code, message, where);
  }
  info(code: string, message: string, where?: { file?: string; row?: number }) {
    this.add('info', code, message, where);
  }
  count(code: string, by = 1) {
    this.counts.set(code, (this.counts.get(code) ?? 0) + by);
  }
  get(code: string): number {
    return this.counts.get(code) ?? 0;
  }
  get hasErrors(): boolean {
    return this.entries.some((e) => e.level === 'error');
  }
}
