import { z } from 'zod';

// ─── Disclaimer ───────────────────────────────────────────────
export const AI_DISCLAIMER =
  '⚠️ 免責聲明：本報告由人工智慧生成，僅供健康趨勢參考，不構成醫療診斷、治療建議或處方指示。如有任何健康疑慮，請諮詢合格的醫療專業人員。';

// ─── Report Types & Chat Tasks ────────────────────────────────
export const AI_REPORT_TYPE_VALUES = [
  'health_summary',
  'trend_analysis',
  'visit_prep',
  'family_update',
] as const;

export const AI_CHAT_TASK_VALUES = [
  'trend_explanation',
  'family_update',
  'visit_questions',
] as const;

export const AI_STATUS_LABEL_VALUES = [
  'stable',
  'attention',
  'consult_doctor',
] as const;

// ─── Request Schemas ──────────────────────────────────────────

export const HealthReportCreateSchema = z.object({
  recipient_id: z.string().uuid(),
  report_type: z.enum(AI_REPORT_TYPE_VALUES),
});

export const AiChatCreateSchema = z.object({
  recipient_id: z.string().uuid(),
  task: z.enum(AI_CHAT_TASK_VALUES),
  context: z.record(z.unknown()).optional(),
});

export const AiReportListQuerySchema = z.object({
  recipient_id: z.string().uuid(),
  report_type: z.enum(AI_REPORT_TYPE_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── AI Output Validation Schemas ─────────────────────────────

export const HealthSummaryOutputSchema = z.object({
  status_label: z.enum(AI_STATUS_LABEL_VALUES),
  summary: z.string().min(1).max(100),
  reasons: z.array(z.string().min(1).max(200)).min(1).max(5),
  suggestions: z.array(z.string().min(1).max(200)).min(1).max(5),
});

export const TrendAnalysisOutputSchema = z.object({
  trend_direction: z.enum(['improving', 'stable', 'worsening']),
  explanation: z.string().min(1).max(300),
  key_observations: z.array(z.string().min(1).max(200)).min(1).max(5),
  suggestions: z.array(z.string().min(1).max(200)).min(1).max(5),
});

export const VisitPrepOutputSchema = z.object({
  questions: z
    .array(z.object({ category: z.string().min(1).max(50), question: z.string().min(1).max(200) }))
    .min(1)
    .max(10),
  data_to_bring: z.array(z.string().min(1).max(200)).min(1).max(5),
  notes: z.string().max(300),
});

export const FamilyUpdateOutputSchema = z.object({
  greeting: z.string().max(50),
  health_update: z.string().min(1).max(300),
  highlights: z.array(z.string().min(1).max(200)).min(1).max(5),
  closing: z.string().max(100),
});

/** Map report_type → output schema */
export const AI_OUTPUT_SCHEMAS = {
  health_summary: HealthSummaryOutputSchema,
  trend_analysis: TrendAnalysisOutputSchema,
  visit_prep: VisitPrepOutputSchema,
  family_update: FamilyUpdateOutputSchema,
} as const;

// ─── Chat Output Schemas ──────────────────────────────────────

export const TrendExplanationOutputSchema = z.object({
  explanation: z.string().min(1).max(500),
  key_points: z.array(z.string().min(1).max(200)).min(1).max(5),
});

export const FamilyChatOutputSchema = z.object({
  message: z.string().min(1).max(500),
  highlights: z.array(z.string().min(1).max(200)).min(1).max(5),
});

export const VisitQuestionsOutputSchema = z.object({
  questions: z.array(z.string().min(1).max(200)).min(1).max(10),
  reminders: z.array(z.string().min(1).max(200)).min(1).max(5),
});

export const AI_CHAT_OUTPUT_SCHEMAS = {
  trend_explanation: TrendExplanationOutputSchema,
  family_update: FamilyChatOutputSchema,
  visit_questions: VisitQuestionsOutputSchema,
} as const;

// ─── Assistant Request Schema (Phase 2 — bounded free-text) ──

/** All supported task families for classification */
export const AI_TASK_FAMILY_VALUES = [
  ...AI_REPORT_TYPE_VALUES,
  ...AI_CHAT_TASK_VALUES,
] as const;

export const AiAssistantPreviousContextSchema = z.object({
  user_message: z.string().max(200),
  routed_task: z.string().max(30),
  response_summary: z.string().max(200),
}).strict();

export const AiAssistantRequestSchema = z.object({
  recipient_id: z.string().uuid(),
  message: z.string().min(1).max(500),
  previous_context: AiAssistantPreviousContextSchema.optional(),
});

export const AiInteractionListQuerySchema = z.object({
  recipient_id: z.string().uuid(),
  page: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().int().min(1).default(1)),
  limit: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().int().min(1).max(50).default(10)),
});

// ─── Inferred Types ───────────────────────────────────────────

export type HealthReportCreateInput = z.infer<typeof HealthReportCreateSchema>;
export type AiChatCreateInput = z.infer<typeof AiChatCreateSchema>;
export type AiReportListQuery = z.infer<typeof AiReportListQuerySchema>;
export type HealthSummaryOutput = z.infer<typeof HealthSummaryOutputSchema>;
export type TrendAnalysisOutput = z.infer<typeof TrendAnalysisOutputSchema>;
export type VisitPrepOutput = z.infer<typeof VisitPrepOutputSchema>;
export type FamilyUpdateOutput = z.infer<typeof FamilyUpdateOutputSchema>;
export type TrendExplanationOutput = z.infer<typeof TrendExplanationOutputSchema>;
export type FamilyChatOutput = z.infer<typeof FamilyChatOutputSchema>;
export type VisitQuestionsOutput = z.infer<typeof VisitQuestionsOutputSchema>;

// AiReportType and AiStatusLabel are already exported from constants/enums.ts
export type AiChatTask = (typeof AI_CHAT_TASK_VALUES)[number];
export type AiAssistantRequest = z.infer<typeof AiAssistantRequestSchema>;
export type AiInteractionListQuery = z.infer<typeof AiInteractionListQuerySchema>;
export type AiTaskFamily = (typeof AI_TASK_FAMILY_VALUES)[number];
