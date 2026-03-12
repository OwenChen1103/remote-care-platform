import { z } from 'zod';

export const ProviderCreateSchema = z.object({
  user_id: z.string().uuid().optional(),
  name: z.string().min(1, '姓名為必填').max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  level: z.enum(['L1', 'L2', 'L3']).default('L1'),
  specialties: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  experience_years: z.number().int().min(0).optional(),
  service_areas: z.array(z.string()).default([]),
  availability_status: z.enum(['available', 'busy', 'offline']).default('available'),
});

export const ProviderUpdateSchema = ProviderCreateSchema.partial();

export const ProviderReviewSchema = z.object({
  review_status: z.enum(['approved', 'suspended']),
  admin_note: z.string().optional(),
});

export type ProviderCreateInput = z.infer<typeof ProviderCreateSchema>;
export type ProviderUpdateInput = z.infer<typeof ProviderUpdateSchema>;
export type ProviderReviewInput = z.infer<typeof ProviderReviewSchema>;
