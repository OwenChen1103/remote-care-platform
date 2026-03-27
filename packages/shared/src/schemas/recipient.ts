import { z } from 'zod';

export const RELATIONSHIP_VALUES = [
  'father', 'mother', 'grandfather', 'grandmother',
  'spouse', 'sibling', 'child', 'other',
] as const;

export type Relationship = typeof RELATIONSHIP_VALUES[number];

export const RecipientCreateSchema = z.object({
  name: z.string().min(1, '姓名為必填').max(100, '姓名不得超過 100 字'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD').optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  relationship: z.enum(RELATIONSHIP_VALUES).optional(),
  medical_tags: z.array(z.string().max(50, '單一標籤不得超過 50 字')).max(20, '疾病標籤最多 20 個').default([]),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
  address: z.string().max(500, '地址不得超過 500 字').optional(),
  notes: z.string().max(500, '備註不得超過 500 字').optional(),
});

export const RecipientUpdateSchema = RecipientCreateSchema.partial();

export const RecipientResponseSchema = z.object({
  id: z.string().uuid(),
  caregiver_id: z.string().uuid(),
  patient_user_id: z.string().uuid().nullable(),
  name: z.string(),
  date_of_birth: z.string().nullable(),
  gender: z.string().nullable(),
  relationship: z.string().nullable(),
  medical_tags: z.array(z.string()),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type RecipientCreateInput = z.infer<typeof RecipientCreateSchema>;
export type RecipientUpdateInput = z.infer<typeof RecipientUpdateSchema>;
export type RecipientResponse = z.infer<typeof RecipientResponseSchema>;
