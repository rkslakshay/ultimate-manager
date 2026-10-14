import { useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { ApiError } from '@/lib/api';

/**
 * Minimal form state helper: client-side validation with a shared Zod schema, plus merging of
 * server-side field errors (ApiError.fieldErrors) into the same error map.
 */
export function useZodForm<S extends z.ZodObject>(schema: S, initial: z.input<S>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = (name: keyof z.input<S> & string) => (value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors(({ [name]: _removed, ...rest }) => rest);
  };

  const handleSubmit =
    (onValid: (data: z.output<S>) => Promise<unknown>) => async (event: FormEvent) => {
      event.preventDefault();
      setFormError(null);
      const result = schema.safeParse(values);
      if (!result.success) {
        const next: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = String(issue.path[0] ?? '_');
          next[key] ??= issue.message;
        }
        setErrors(next);
        return;
      }
      setErrors({});
      try {
        await onValid(result.data);
      } catch (err) {
        if (err instanceof ApiError) {
          const fieldErrors = Object.fromEntries(
            Object.entries(err.fieldErrors).map(([k, v]) => [k, v[0] ?? '']),
          );
          setErrors(fieldErrors);
          if (Object.keys(fieldErrors).length === 0) setFormError(err.message);
        } else {
          setFormError('Something went wrong');
        }
      }
    };

  return { values, errors, formError, set, handleSubmit };
}
