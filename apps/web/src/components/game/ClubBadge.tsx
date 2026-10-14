import type { ClubRefDto } from '@um/shared';
import { useState } from 'react';
import { useCrests } from '@/features/packs/api';
import { cn } from '@/lib/utils';

const DIMS = { sm: 'size-5 text-[8px]', md: 'size-8 text-2xs', lg: 'size-14 text-sm' } as const;

/**
 * Club badge. No real crests ship with the game: if the user dropped an image into
 * data-packs/assets/crests/<crestKey>.png it is shown, otherwise a placeholder is generated
 * from the club's colours and code.
 */
export function ClubBadge({
  club,
  size = 'sm',
  className,
}: {
  club: Pick<ClubRefDto, 'code' | 'primaryColor' | 'secondaryColor'> & { crestKey?: string | null };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const crests = useCrests();
  const [failed, setFailed] = useState(false);
  const key = club.crestKey;
  if (key && crests.data?.has(key) && !failed) {
    return (
      <img
        src={`/api/assets/crests/${key}`}
        alt=""
        aria-hidden
        onError={() => setFailed(true)}
        className={cn('inline-block shrink-0 object-contain', DIMS[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border font-bold',
        DIMS[size],
        className,
      )}
      style={{
        background: club.primaryColor,
        color: club.secondaryColor,
        borderColor: club.secondaryColor,
      }}
    >
      {club.code}
    </span>
  );
}
