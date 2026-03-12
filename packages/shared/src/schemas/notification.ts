import { z } from 'zod';

// ─── Notification Schemas ────────────────────────────────────

export const NotificationListQuerySchema = z.object({
  is_read: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const NotificationResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'measurement_reminder',
    'abnormal_alert',
    'appointment_reminder',
    'service_request_update',
    'ai_report_ready',
  ]),
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
});

export const UnreadCountResponseSchema = z.object({
  count: z.number().int().min(0),
});

// ─── Reminder Schemas ────────────────────────────────────────

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ReminderUpdateSchema = z.object({
  reminder_time: z
    .string()
    .regex(TIME_REGEX, '時間格式須為 HH:mm')
    .optional(),
  is_enabled: z.boolean().optional(),
});

export const ReminderResponseSchema = z.object({
  id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  reminder_type: z.enum(['morning', 'evening']),
  reminder_time: z.string(),
  is_enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ─── Types ───────────────────────────────────────────────────

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;
export type ReminderUpdate = z.infer<typeof ReminderUpdateSchema>;
export type ReminderResponse = z.infer<typeof ReminderResponseSchema>;
