import type { SaveGameDto } from '@um/shared';
import { useOutletContext } from 'react-router';

/** The save game being played, provided by GameLayout to every in-game page. */
export function useGameSave(): SaveGameDto {
  return useOutletContext<SaveGameDto>();
}
