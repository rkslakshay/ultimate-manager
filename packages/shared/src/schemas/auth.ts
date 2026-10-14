import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address' }).max(254));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt input limit
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), {
    message: 'Password must contain at least one letter and one number',
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(40, 'Name must be at most 40 characters');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(72),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const authResponseSchema = z.object({ user: userDtoSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;
