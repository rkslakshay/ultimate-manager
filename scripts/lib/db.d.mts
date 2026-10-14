export interface DbUrlParts {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function parseDbUrl(url: string): DbUrlParts;
export function ensurePostgres(url: string, mode?: string): Promise<(() => Promise<void>) | null>;
export function ensureDatabase(url: string): Promise<void>;
export function migrateDeploy(url: string): Promise<string>;
export function runPrisma(args: string[], url: string): Promise<string>;
