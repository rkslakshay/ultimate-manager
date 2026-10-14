import {
  ATTRIBUTE_KEYS,
  type DayNumber,
  type ProgressionResult,
  type ReviewKind,
} from '@um/engine';
import type { AttributeChangeDto } from '@um/shared';
import type { Db } from '../db';
import type { Prisma, PlayerAttributeChange } from '../generated/prisma/client';
import { dayToDate, isoDate } from './convert';

type Tx = Prisma.TransactionClient | Db;

/** Store the attribute changes of one progression review (used by the season loop). */
export async function recordProgression(
  tx: Tx,
  saveId: string,
  playerId: number,
  day: DayNumber,
  period: ReviewKind,
  result: Pick<ProgressionResult, 'changes' | 'caBefore' | 'caAfter'>,
): Promise<void> {
  if (!result.changes.length) return;
  await tx.playerAttributeChange.createMany({
    data: result.changes.map((c) => ({
      saveId,
      playerId,
      date: dayToDate(day),
      period,
      attribute: c.attribute,
      fromValue: c.from,
      toValue: c.to,
      reason: c.reason,
      caBefore: result.caBefore,
      caAfter: result.caAfter,
    })),
  });
}

export const toAttributeChangeDto = (r: PlayerAttributeChange): AttributeChangeDto => ({
  date: isoDate(r.date),
  period: r.period as AttributeChangeDto['period'],
  attribute: ATTRIBUTE_KEYS[r.attribute] ?? String(r.attribute),
  from: r.fromValue,
  to: r.toValue,
  reason: r.reason as AttributeChangeDto['reason'],
  caBefore: r.caBefore,
  caAfter: r.caAfter,
});
