import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-3xl font-bold text-fg-subtle">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Button asChild variant="primary">
        <Link to="/">Go home</Link>
      </Button>
    </main>
  );
}
