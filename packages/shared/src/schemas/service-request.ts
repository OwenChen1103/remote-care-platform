import { z } from 'zod';

export const ServiceRequestCreateSchema = z.object({
  recipient_id: z.string().uuid(),
  category_id: z.string().uuid(),
  preferred_date: z.string().datetime(),
  preferred_time_slot: z.enum(['morning', 'afternoon', 'evening']).optional(),
  location: z.string().min(1, '服務地點為必填').max(500),
  description: z.string().min(1, '需求描述為必填'),
});

export const ServiceRequestStatusUpdateSchema = z.object({
  status: z.enum([
    'screening',
    'candidate_proposed',
    'caregiver_confirmed',
    'provider_confirmed',
    'arranged',
    'in_service',
    'completed',
    'cancelled',
  ]),
  admin_note: z.string().optional(),
});

export const ServiceRequestAssignSchema = z.object({
  provider_id: z.string().uuid(),
});

export const ServiceRequestProposeCandidateSchema = z.object({
  provider_id: z.string().uuid(),
  admin_note: z.string().optional(),
});

export const ServiceRequestCaregiverConfirmSchema = z.object({
  confirm: z.boolean(),
  note: z.string().max(500).optional(),
});

export const ServiceRequestProviderConfirmSchema = z.object({
  confirm: z.boolean(),
  provider_note: z.string().max(1000).optional(),
});

export const ServiceRequestProviderProgressSchema = z.object({
  status: z.enum(['in_service', 'completed']),
  provider_note: z.string().max(1000).optional(),
});

export type ServiceRequestCreateInput = z.infer<typeof ServiceRequestCreateSchema>;
export type ServiceRequestStatusUpdate = z.infer<typeof ServiceRequestStatusUpdateSchema>;
export type ServiceRequestAssignInput = z.infer<typeof ServiceRequestAssignSchema>;
export type ServiceRequestProposeCandidateInput = z.infer<typeof ServiceRequestProposeCandidateSchema>;
export type ServiceRequestCaregiverConfirmInput = z.infer<typeof ServiceRequestCaregiverConfirmSchema>;
export type ServiceRequestProviderConfirmInput = z.infer<typeof ServiceRequestProviderConfirmSchema>;
export type ServiceRequestProviderProgressInput = z.infer<typeof ServiceRequestProviderProgressSchema>;
