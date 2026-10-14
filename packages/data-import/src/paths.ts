import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..', '..');

/** Root of the data-packs folder (override with DATA_PACKS_DIR, e.g. for tests). */
export function dataPacksDir(): string {
  return process.env.DATA_PACKS_DIR
    ? path.resolve(process.env.DATA_PACKS_DIR)
    : path.join(REPO_ROOT, 'data-packs');
}

export const packPaths = (root = dataPacksDir()) => ({
  root,
  raw: path.join(root, 'raw'),
  staging: path.join(root, 'staging'),
  processed: path.join(root, 'processed'),
  reports: path.join(root, 'reports'),
  config: path.join(root, 'config'),
  crests: path.join(root, 'assets', 'crests'),
});
