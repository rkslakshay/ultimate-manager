import type { ClubRefDto } from '@um/shared';
import { cn } from '@/lib/utils';

/** Simple kit-coloured badge with the club's code: fictional clubs have no crests. */
export function ClubBadge({
  club,
  size = 'sm',
  className,
}: {
  club: Pick<ClubRefDto, 'code' | 'primaryColor' | 'secondaryColor'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = { sm: 'size-5 text-[8px]', md: 'size-8 text-2xs', lg: 'size-14 text-sm' }[size];
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border font-bold',
        dims,
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
