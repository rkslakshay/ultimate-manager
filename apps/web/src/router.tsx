import { createBrowserRouter, Navigate } from 'react-router';
import { NotFoundPage } from '@/components/NotFoundPage';
import { PublicOnly, RequireAuth } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { GameLayout } from '@/features/game/GameLayout';
import { SectionPage } from '@/features/game/SectionPage';
import { SavesPage } from '@/features/saves/SavesPage';
import { UiKitPage } from '@/features/ui-kit/UiKitPage';
import { EditorPage } from '@/features/editor/EditorPage';
import { ChooseClubPage } from '@/features/world/ChooseClubPage';
import { ClubPage } from '@/features/world/ClubPage';
import { LeaguePage } from '@/features/world/LeaguePage';
import { PlayerPage } from '@/features/world/PlayerPage';
import { SearchPage } from '@/features/world/SearchPage';
import { SquadPage } from '@/features/world/SquadPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/saves" replace /> },
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/saves', element: <SavesPage /> },
      {
        path: '/game/:saveId',
        element: <GameLayout />,
        children: [
          { index: true, element: <Navigate to="inbox" replace /> },
          { path: 'ui-kit', element: <UiKitPage /> },
          { path: 'choose-club', element: <ChooseClubPage /> },
          { path: 'squad', element: <SquadPage /> },
          { path: 'club', element: <ClubPage own /> },
          { path: 'clubs/:clubId', element: <ClubPage /> },
          { path: 'players/:playerId', element: <PlayerPage /> },
          { path: 'league', element: <LeaguePage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'editor', element: <EditorPage /> },
          { path: ':section', element: <SectionPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
