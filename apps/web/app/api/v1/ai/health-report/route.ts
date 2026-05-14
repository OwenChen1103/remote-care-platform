import { NextRequest } from 'next/server';
import { HealthReportCreateSchema, AI_DISCLAIMER } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { checkReportRateLimit } from '@/lib/ai-rate-limit';
import { generateReport, buildPromptContext } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    if (auth.role !== 'caregiver') {
      return errorResponse('AUTH_FORBIDDEN', '僅照護者可生成 AI 報告');
    }

    const body: unknown = await request.json();
    const parsed = HealthReportCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { recipient_id, report_type } = parsed.data;

    // Ownership check
    const recipient = await prisma.recipient.findFirst({
      where: { id: recipient_id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    // Rate limit check
    const rateCheck = await checkReportRateLimit(auth.userId, recipient_id, report_type);
    if (!rateCheck.allowed) {
      return errorResponse('AI_RATE_LIMITED', '已達到報告生成上限，請稍後再試');
    }

    // Fetch recent measurements for context (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const measurements = await prisma.measurement.findMany({
      where: {
        recipient_id,
        measured_at: { gte: thirtyDaysAgo },
      },
      orderBy: { measured_at: 'desc' },
      take: 50,
    });

    // Block report generation when there's no measurement data:
    //   1. The LLM happily hallucinates `status_label: 'attention'` for empty
    //      data (we used to persist whatever it returned), which then leaks
    //      into `calculateHealthScore` and corrupts the home-page score.
    //   2. The report content for zero-measurement input is just "no data" —
    //      not actionable, wastes LLM tokens.
    // Force user to record at least one measurement first.
    if (measurements.length === 0) {
      return errorResponse(
        'VALIDATION_ERROR',
        '請先為被照護者記錄至少一筆量測資料，才能生成安心報',
      );
    }

    // Build context and generate
    const ctx = buildPromptContext(recipient, measurements);
    const result = await generateReport(report_type, ctx);

    // Persist report
    const output = result.output as {
      status_label?: string;
      summary?: string;
      reasons?: string[];
      suggestions?: string[];
      trend_direction?: string;
      explanation?: string;
      key_observations?: string[];
      questions?: unknown[];
      data_to_bring?: string[];
      notes?: string;
      greeting?: string;
      health_update?: string;
      highlights?: string[];
      closing?: string;
    };

    // Normalize fields for DB storage based on report type
    const statusLabel =
      output.status_label ??
      (output.trend_direction === 'worsening' ? 'attention' : 'stable');
    const summary =
      output.summary ?? output.explanation ?? output.health_update ?? output.notes ?? '';
    const reasons =
      output.reasons ?? output.key_observations ?? output.highlights ?? [];
    const suggestions =
      output.suggestions ?? output.data_to_bring ?? [];

    const report = await prisma.aiReport.create({
      data: {
        recipient_id,
        report_type,
        status_label: statusLabel,
        summary,
        reasons,
        suggestions,
        raw_prompt: result.raw_prompt,
        raw_response: result.raw_response,
        model: result.model,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
      },
    });

    return successResponse(
      {
        id: report.id,
        recipient_id: report.recipient_id,
        report_type: report.report_type,
        status_label: report.status_label,
        summary: report.summary,
        reasons: report.reasons,
        suggestions: report.suggestions,
        detail: result.output,
        disclaimer: AI_DISCLAIMER,
        is_fallback: result.is_fallback,
        generated_at: report.generated_at,
      },
      201,
    );
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
