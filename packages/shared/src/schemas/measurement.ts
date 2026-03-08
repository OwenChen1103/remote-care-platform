import { z } from 'zod';

const BaseMeasurementSchema = z.object({
  recipient_id: z.string().uuid(),
  source: z.enum(['manual', 'device']).default('manual'),
  device_id: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
  measured_at: z.string().datetime({ offset: true }),
});

export const BloodPressureCreateSchema = BaseMeasurementSchema.extend({
  type: z.literal('blood_pressure'),
  systolic: z.number().int().min(40).max(300),
  diastolic: z.number().int().min(20).max(200),
  heart_rate: z.number().int().min(30).max(250).optional(),
  unit: z.literal('mmHg'),
});

export const BloodGlucoseCreateSchema = BaseMeasurementSchema.extend({
  type: z.literal('blood_glucose'),
  glucose_value: z.number().min(10).max(800),
  glucose_timing: z.enum(['before_meal', 'after_meal', 'fasting', 'random']),
  unit: z.literal('mg/dL'),
});

export const MeasurementCreateSchema = z.discriminatedUnion('type', [
  BloodPressureCreateSchema,
  BloodGlucoseCreateSchema,
]);

export const MeasurementQuerySchema = z.object({
  recipient_id: z.string().uuid(),
  type: z.enum(['blood_pressure', 'blood_glucose']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const MeasurementStatsQuerySchema = z.object({
  recipient_id: z.string().uuid(),
  type: z.enum(['blood_pressure', 'blood_glucose']),
  period: z.enum(['7d', '30d']),
});

export type BloodPressureCreateInput = z.infer<typeof BloodPressureCreateSchema>;
export type BloodGlucoseCreateInput = z.infer<typeof BloodGlucoseCreateSchema>;
export type MeasurementCreateInput = z.infer<typeof MeasurementCreateSchema>;
export type MeasurementQuery = z.infer<typeof MeasurementQuerySchema>;
export const MeasurementExportQuerySchema = z.object({
  recipient_id: z.string().uuid(),
  type: z.enum(['blood_pressure', 'blood_glucose']),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export type MeasurementStatsQuery = z.infer<typeof MeasurementStatsQuerySchema>;
export type MeasurementExportQuery = z.infer<typeof MeasurementExportQuerySchema>;
