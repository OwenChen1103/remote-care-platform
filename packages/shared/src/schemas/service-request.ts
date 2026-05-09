import { z } from 'zod';

// ── Service Category Schemas ──

export const ServiceCategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type ServiceCategoryUpdateInput = z.infer<typeof ServiceCategoryUpdateSchema>;

// ── Service Request Schemas ──

export const ServiceRequestListQuerySchema = z.object({
  status: z.string().optional(),
  category_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ServiceRequestListQuery = z.infer<typeof ServiceRequestListQuerySchema>;

export const ServiceRequestCancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type ServiceRequestCancelInput = z.infer<typeof ServiceRequestCancelSchema>;

export const ServiceRequestCreateSchema = z.object({
  recipient_id: z.string().uuid(),
  category_id: z.string().uuid(),
  preferred_date: z.string().datetime(),
  preferred_time_slot: z.enum(['morning', 'afternoon', 'evening']).optional(),
  location: z.string().min(1, '服務地點為必填').max(500),
  departure_location: z.string().max(500).optional(),
  destination: z.string().max(500).optional(),
  service_duration: z.number().int().min(1).max(24).optional(),
  description: z.string().min(1, '需求描述為必填'),
  metadata: z.record(z.unknown()).default({}),
});

export const ServiceRequestStatusUpdateSchema = z.object({
  status: z.enum([
    'submitted',
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

// Health data sub-schema — strictly typed structured fields collected during a service visit.
// Exported separately so mobile readers (caregiver/patient/provider screens) can type-narrow.
// `.strict()` ensures unknown keys are rejected — both the writer (provider mobile) and
// any future API surface won't silently lose fields to schema drift.
export const ProviderReportHealthDataSchema = z.object({
  blood_pressure: z.object({
    systolic: z.number().int().min(40).max(260),
    diastolic: z.number().int().min(20).max(180),
  }).strict().optional(),
  heart_rate: z.number().int().min(20).max(220).optional(),
  blood_glucose: z.number().min(20).max(600).optional(),
  blood_oxygen: z.number().int().min(50).max(100).optional(),
  height_cm: z.number().min(50).max(250).optional(),
  weight_kg: z.number().min(10).max(300).optional(),
  body_fat_pct: z.number().min(0).max(80).optional(),
  muscle_mass_kg: z.number().min(0).max(150).optional(),
  cholesterol: z.number().min(0).max(600).optional(),
}).strict();

export const ProviderReportSchema = z.object({
  service_date: z.string().optional(),
  health_data: ProviderReportHealthDataSchema.optional(),
  medication_notes: z.string().max(1000).optional(),
  doctor_instructions: z.string().max(1000).optional(),
  next_visit_date: z.string().optional(),
  additional_notes: z.string().max(2000).optional(),
}).strict();

export const ServiceRequestProviderProgressSchema = z.object({
  status: z.enum(['in_service', 'completed']),
  provider_note: z.string().max(1000).optional(),
  provider_report: ProviderReportSchema.optional(),
});

export type ServiceRequestCreateInput = z.infer<typeof ServiceRequestCreateSchema>;
export type ServiceRequestStatusUpdate = z.infer<typeof ServiceRequestStatusUpdateSchema>;
export type ServiceRequestAssignInput = z.infer<typeof ServiceRequestAssignSchema>;
export type ServiceRequestProposeCandidateInput = z.infer<typeof ServiceRequestProposeCandidateSchema>;
export type ServiceRequestCaregiverConfirmInput = z.infer<typeof ServiceRequestCaregiverConfirmSchema>;
export type ServiceRequestProviderConfirmInput = z.infer<typeof ServiceRequestProviderConfirmSchema>;
export type ServiceRequestProviderProgressInput = z.infer<typeof ServiceRequestProviderProgressSchema>;
export type ProviderReportInput = z.infer<typeof ProviderReportSchema>;
export type ProviderReportHealthData = z.infer<typeof ProviderReportHealthDataSchema>;
