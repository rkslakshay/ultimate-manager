import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { meQueryKey } from './features/auth/api';
import { onUnauthorized } from './lib/api';
import { queryClient } from './lib/query-client';
import { router } from './router';
import './styles/index.css';

// A 401 from any data request means the session ended: drop cached data and show sign-in.
onUnauthorized(() => {
  queryClient.clear();
  queryClient.setQueryData(meQueryKey, null);
});

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-strong)',
            color: 'var(--color-fg)',
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
