import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound, parseInput } from '../lib/errors';
import type { PackService } from '../packs/service';

/** GET /api/packs — data packs a new save can start from. */
export async function packRoutes(app: FastifyInstance, { packs }: { packs: PackService }) {
  app.get('/', async (request) => {
    await app.authenticate(request);
    return { items: packs.list() };
  });
}

const CREST_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const crestParams = z.object({ key: z.string().regex(/^[a-z0-9-]{1,80}$/) });

/**
 * GET /api/assets/crests/:key — the user's own crest image, if they put one in
 * data-packs/assets/crests/<key>.(png|svg|jpg|webp). No images ship with the game.
 */
export async function assetRoutes(app: FastifyInstance, { packs }: { packs: PackService }) {
  app.get('/crests/:key', async (request, reply) => {
    const { key } = parseInput(crestParams, request.params);
    for (const [ext, type] of Object.entries(CREST_TYPES)) {
      const file = path.join(packs.crestsDir, `${key}${ext}`);
      if (fs.existsSync(file)) {
        return (
          reply
            .header('content-type', type)
            .header('cache-control', 'private, max-age=3600')
            // SVGs can contain script: never let the browser run it in our origin.
            .header(
              'content-security-policy',
              "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            )
            .send(fs.createReadStream(file))
        );
      }
    }
    throw notFound('Crest');
  });
}
