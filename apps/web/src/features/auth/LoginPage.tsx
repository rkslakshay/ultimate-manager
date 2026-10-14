import { loginRequestSchema } from '@um/shared';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/input';
import { useLogin } from './api';
import { AuthLayout } from './AuthLayout';
import { FormAlert } from './FormAlert';
import { useZodForm } from './useZodForm';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const { values, errors, formError, set, handleSubmit } = useZodForm(loginRequestSchema, {
    email: '',
    password: '',
  });
  const from = (location.state as { from?: string } | null)?.from ?? '/saves';

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back, gaffer. Your squad is waiting."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="text-accent-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (data) => {
          await login.mutateAsync(data);
          void navigate(from, { replace: true });
        })}
      >
        <FormAlert message={formError} />
        <FormField label="Email" error={errors.email}>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="email"
              autoFocus
              value={values.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Password" error={errors.password}>
          {(field) => (
            <Input
              {...field}
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(e) => set('password')(e.target.value)}
            />
          )}
        </FormField>
        <Button type="submit" variant="primary" size="lg" loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
