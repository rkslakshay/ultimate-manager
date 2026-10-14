import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-accent-muted),transparent_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-2xl">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 mb-5 text-xs text-fg-muted">{subtitle}</p>
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-fg-muted">{footer}</p>
      </div>
    </main>
  );
}
