import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  password: z
    .string()
    .min(8, '密碼至少 8 個字元')
    .regex(/[a-z]/, '密碼需包含小寫字母')
    .regex(/[A-Z]/, '密碼需包含大寫字母')
    .regex(/[0-9]/, '密碼需包含數字'),
  name: z.string().min(1, '姓名為必填').max(100, '姓名不得超過 100 字'),
  phone: z.string().max(20).optional(),
  timezone: z.string().default('Asia/Taipei'),
  role: z.enum(['caregiver', 'patient', 'provider']).default('caregiver'),
});

export const LoginSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  password: z.string().min(1, '密碼為必填'),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  timezone: z.string().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD').optional().nullable(),
  address: z.string().max(500, '地址不得超過 500 字').optional().nullable(),
});

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['caregiver', 'patient', 'provider', 'admin']),
  phone: z.string().nullable(),
  timezone: z.string(),
  date_of_birth: z.string().nullable(),
  address: z.string().nullable(),
  created_at: z.string(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
