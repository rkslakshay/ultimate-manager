import { CircleAlert } from 'lucide-react';

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-muted px-3 py-2 text-xs text-danger"
    >
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {message}
    </div>
  );
}
