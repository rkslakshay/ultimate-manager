import { registerRequestSchema } from '@um/shared';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/input';
import { useRegister } from './api';
import { AuthLayout } from './AuthLayout';
import { FormAlert } from './FormAlert';
import { useZodForm } from './useZodForm';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const { values, errors, formError, set, handleSubmit } = useZodForm(registerRequestSchema, {
    displayName: '',
    email: '',
    password: '',
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One account, up to 10 careers. Your road to glory starts here."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-accent-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (data) => {
          await register.mutateAsync(data);
          void navigate('/saves', { replace: true });
        })}
      >
        <FormAlert message={formError} />
        <FormField label="Display name" error={errors.displayName}>
          {(field) => (
            <Input
              {...field}
              autoComplete="nickname"
              autoFocus
              value={values.displayName}
              onChange={(e) => set('displayName')(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Email" error={errors.email}>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        >
          {(field) => (
            <Input
              {...field}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set('password')(e.target.value)}
            />
          )}
        </FormField>
        <Button type="submit" variant="primary" size="lg" loading={register.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
