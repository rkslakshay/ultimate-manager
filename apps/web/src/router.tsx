import { createBrowserRouter, Navigate } from 'react-router';
import { NotFoundPage } from '@/components/NotFoundPage';
import { PublicOnly, RequireAuth } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { GameLayout } from '@/features/game/GameLayout';
import { SectionPage } from '@/features/game/SectionPage';
import { SavesPage } from '@/features/saves/SavesPage';
import { UiKitPage } from '@/features/ui-kit/UiKitPage';

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
          { path: ':section', element: <SectionPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
