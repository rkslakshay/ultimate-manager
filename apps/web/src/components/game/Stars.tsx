import { abilityStars } from '@um/engine';
import { Star, StarHalf } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 0.5-5 star rating for a 1-200 ability value (current or potential). */
export function Stars({
  ability,
  className,
  label,
}: {
  ability: number;
  className?: string;
  label?: string;
}) {
  const stars = abilityStars(ability);
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  return (
    <span
      className={cn('inline-flex items-center text-warning', className)}
      role="img"
      aria-label={`${label ? `${label}: ` : ''}${stars} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) =>
        i < full ? (
          <Star key={i} className="size-3 fill-current" />
        ) : i === full && half ? (
          <span key={i} className="relative size-3">
            <Star className="absolute size-3 text-surface-3" />
            <StarHalf className="absolute size-3 fill-current" />
          </span>
        ) : (
          <Star key={i} className="size-3 text-surface-3" />
        ),
      )}
    </span>
  );
}
