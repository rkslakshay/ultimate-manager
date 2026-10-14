import { z } from 'zod';

/** Maximum number of save games a single user may hold. */
export const MAX_SAVES_PER_USER = 10;

export const saveNameSchema = z
  .string()
  .trim()
  .min(1, 'Save name is required')
  .max(60, 'Save name must be at most 60 characters');

export const managerNameSchema = z
  .string()
  .trim()
  .min(2, 'Manager name must be at least 2 characters')
  .max(40, 'Manager name must be at most 40 characters');

export const createSaveRequestSchema = z.object({
  name: saveNameSchema,
  managerName: managerNameSchema,
  /** Optional world seed for reproducible worlds; generated server-side when omitted. */
  seed: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[\w-]+$/, 'Seed may only contain letters, numbers, - and _')
    .optional(),
});
export type CreateSaveRequest = z.infer<typeof createSaveRequestSchema>;

export const updateSaveRequestSchema = z.object({ name: saveNameSchema });
export type UpdateSaveRequest = z.infer<typeof updateSaveRequestSchema>;

export const saveGameDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  managerName: z.string(),
  seed: z.string(),
  /** In-game date as ISO date (YYYY-MM-DD). */
  gameDate: z.string(),
  /** Club the manager is in charge of; null until a club is chosen (Phase 1+). */
  clubName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastPlayedAt: z.string(),
});
export type SaveGameDto = z.infer<typeof saveGameDtoSchema>;
