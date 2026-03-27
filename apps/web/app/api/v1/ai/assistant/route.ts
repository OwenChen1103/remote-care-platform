import { NextRequest } from 'next/server';
import { AiAssistantRequestSchema, AI_DISCLAIMER } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { checkChatRateLimit } from '@/lib/ai-rate-limit';
import { generateReport, generateChat, buildPromptContext } from '@/lib/ai';
import type { AiReportType, AiChatTask } from '@remote-care/shared';

// ─── Classification ──────────────────────────────────────────

/**
 * Bounded keyword classifier — routes user free-text into a supported task.
 *
 * This is a conservative rule-based classifier, NOT an open LLM router.
 * If no rule matches, it falls back to 'health_summary' (the safest default).
 *
 * No medical diagnosis routing. No generic Q&A. Only supported task families.
 */
type ClassificationResult =
  | { kind: 'report' | 'chat'; taskKey: string; confidence: 'high' | 'medium'; matched: true }
  | { kind: 'unsupported'; taskKey: null; confidence: 'low'; matched: false };

function classifyUserMessage(message: string): ClassificationResult {
  const m = message.toLowerCase();

  // Visit / clinic preparation — high signal keywords
  if (/看診|就醫|回診|掛號|門診|醫[生師]|就診|問醫/.test(m)) {
    if (/問題|怎麼問|問什麼|準備/.test(m)) {
      return { kind: 'report', taskKey: 'visit_prep', confidence: 'high', matched: true };
    }
    return { kind: 'chat', taskKey: 'visit_questions', confidence: 'medium', matched: true };
  }

  // Trend / change / direction keywords
  if (/趨勢|變化|走[向勢]|比較|波動|起伏|升|降|高了|低了|近期|這週|這幾天/.test(m)) {
    return { kind: 'chat', taskKey: 'trend_explanation', confidence: 'high', matched: true };
  }

  // Family sharing / update keywords
  if (/分享|家人|報告|傳|告訴|近況|給[^\s]*看/.test(m)) {
    if (/摘要|整理|簡短/.test(m)) {
      return { kind: 'report', taskKey: 'family_update', confidence: 'high', matched: true };
    }
    return { kind: 'chat', taskKey: 'family_update', confidence: 'medium', matched: true };
  }

  // Explicit report / summary request
  if (/安心報|報告|摘要|總結|整理|總覽/.test(m)) {
    return { kind: 'report', taskKey: 'health_summary', confidence: 'high', matched: true };
  }

  // Blood pressure / blood glucose specific
  if (/血壓|血糖|收縮|舒張|糖[^\s]/.test(m)) {
    if (/趨勢|變化|最近/.test(m)) {
      return { kind: 'chat', taskKey: 'trend_explanation', confidence: 'medium', matched: true };
    }
    return { kind: 'report', taskKey: 'health_summary', confidence: 'medium', matched: true };
  }

  // General health status inquiry
  if (/怎麼樣|狀況|好不好|還好嗎|健康|身體/.test(m)) {
    return { kind: 'report', taskKey: 'health_summary', confidence: 'medium', matched: true };
  }

  // No match — do NOT guess, return unsupported
  return { kind: 'unsupported', taskKey: null, confidence: 'low', matched: false };
}

// ─── Route Handler ───────────────────────────────────────────

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
      return errorResponse('AUTH_FORBIDDEN', '僅照護者可使用 AI 照護助理');
    }

    const body: unknown = await request.json();
    const parsed = AiAssistantRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { recipient_id, message, previous_context } = parsed.data;

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

    // Rate limit (uses chat rate limit — 10/hr per user)
    const rateCheck = await checkChatRateLimit(auth.userId);
    if (!rateCheck.allowed) {
      return errorResponse('AI_RATE_LIMITED', '已達到 AI 助理上限，請稍後再試');
    }

    // Classify the user's message into a supported task
    const classification = classifyUserMessage(message);

    // If classification did not match any supported task, return guidance — do NOT guess
    if (!classification.matched) {
      return successResponse({
        user_message: message,
        routed_task: null,
        routed_kind: 'unsupported',
        confidence: 'low',
        result: null,
        guidance: '目前我可以幫您整理以下照護相關的資訊：\n\n• 近況安心報 — 整體健康近況\n• 趨勢解讀 — 數據變化分析\n• 看診準備清單 — 就醫問題整理\n• 家人分享摘要 — 給家人的簡短近況\n\n請試試看這些方向，或用上方的功能按鈕直接操作。',
        disclaimer: AI_DISCLAIMER,
        is_fallback: false,
      }, 200);
    }

    // Fetch measurement context
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

    const ctx = buildPromptContext(recipient, measurements);

    // Build follow-up context if provided
    const followUp = previous_context ? {
      user_message: previous_context.user_message,
      routed_task: previous_context.routed_task,
      response_summary: previous_context.response_summary,
    } : undefined;

    // Route to the appropriate generation function
    let aiResult;
    if (classification.kind === 'report') {
      aiResult = await generateReport(classification.taskKey as AiReportType, ctx, followUp);
    } else {
      aiResult = await generateChat(classification.taskKey as AiChatTask, ctx, followUp);
    }

    // Persist the interaction (graceful — if ai_interactions table doesn't exist yet, skip)
    try {
      await prisma.aiInteraction.create({
        data: {
          recipient_id,
          user_id: auth.userId,
          user_message: message,
          routed_task: classification.taskKey,
          response: aiResult.output as object,
          disclaimer: AI_DISCLAIMER,
          is_fallback: aiResult.is_fallback,
          model: aiResult.model,
          input_tokens: aiResult.input_tokens,
          output_tokens: aiResult.output_tokens,
        },
      });
    } catch {
      // Persistence failure is non-critical — the table may not exist yet
      // The AI response is still returned to the user
    }

    return successResponse({
      user_message: message,
      routed_task: classification.taskKey,
      routed_kind: classification.kind,
      confidence: classification.confidence,
      result: aiResult.output,
      guidance: null,
      disclaimer: AI_DISCLAIMER,
      is_fallback: aiResult.is_fallback,
    }, 201);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
