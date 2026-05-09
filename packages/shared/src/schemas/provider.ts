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

// review_status enum:
// - 'approved'  : reviewer approves; admin_note optional
// - 'rejected'  : reviewer rejects; admin_note REQUIRED (provider can reapply via /provider/me/reapply)
// - 'suspended' : ops suspends an already-approved provider; admin_note REQUIRED
// Note: 'pending' is the default state when a Provider row is first created — it's not a valid input
//       to /providers/[id]/review (admin can't manually set provider back to pending; only reapply can).
export const ProviderReviewSchema = z.object({
  review_status: z.enum(['approved', 'rejected', 'suspended']),
  admin_note: z.string().max(1000).optional(),
}).refine(
  (v) => v.review_status === 'approved' || (v.admin_note !== undefined && v.admin_note.trim().length > 0),
  { message: '拒絕或停權時必須填寫管理備註', path: ['admin_note'] },
);

// ProviderReapplySchema — required body for POST /provider/me/reapply.
// `acknowledged_note: true` forces provider to confirm they read the rejection reason before resubmitting.
export const ProviderReapplySchema = z.object({
  acknowledged_note: z.boolean().refine((v) => v === true, '請先確認已了解前次未通過原因'),
});
export type ProviderReapplyInput = z.infer<typeof ProviderReapplySchema>;

// Self-service: providers can update these fields (not level, review_status)
export const ProviderSelfUpdateSchema = z.object({
  phone: z.string().max(20).optional(),
  education: z.string().max(200).optional().nullable(),
  specialties: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  experience_years: z.number().int().min(0).optional(),
  service_areas: z.array(z.string()).optional(),
  available_services: z.array(z.string()).optional(),
  available_schedule: z.record(z.array(z.string())).optional(),
  schedule_note: z.string().max(500).optional().nullable(),
  availability_status: z.enum(['available', 'busy', 'offline']).optional(),
});

export type ProviderCreateInput = z.infer<typeof ProviderCreateSchema>;
export type ProviderUpdateInput = z.infer<typeof ProviderUpdateSchema>;
export type ProviderReviewInput = z.infer<typeof ProviderReviewSchema>;
export type ProviderSelfUpdateInput = z.infer<typeof ProviderSelfUpdateSchema>;
