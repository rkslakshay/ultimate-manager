import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, letting later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Tone bucket (1-5) for a 1-20 player attribute; maps to the --color-attr-N tokens. */
export function attributeTone(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value <= 5) return 1;
  if (value <= 9) return 2;
  if (value <= 12) return 3;
  if (value <= 15) return 4;
  return 5;
}

const ATTR_CLASS = {
  1: 'text-attr-1',
  2: 'text-attr-2',
  3: 'text-attr-3',
  4: 'text-attr-4',
  5: 'text-attr-5',
} as const;

export function attributeClass(value: number): string {
  return ATTR_CLASS[attributeTone(value)];
}
