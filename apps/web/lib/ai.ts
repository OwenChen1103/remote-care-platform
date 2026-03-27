import OpenAI from 'openai';
import type { ZodSchema } from 'zod';
import { AI_LIMITS } from '@remote-care/shared';
import type { AiReportType, AiChatTask } from '@remote-care/shared';
import { AI_OUTPUT_SCHEMAS, AI_CHAT_OUTPUT_SCHEMAS } from '@remote-care/shared';
import { buildReportPrompt, buildChatPrompt } from './ai-prompts';
import type { PromptContext, FollowUpContext } from './ai-prompts';

function getClient(): OpenAI {
  const baseURL = process.env.OPENAI_BASE_URL ?? undefined;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '', baseURL, timeout: AI_LIMITS.TIMEOUT_MS });
}

function getModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}

function shouldDebugLog(): boolean {
  return process.env.AI_DEBUG_LOGGING === 'true' && process.env.NODE_ENV !== 'production';
}

export interface AiGenerationResult {
  output: Record<string, unknown>;
  raw_prompt: string | null;
  raw_response: string | null;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  is_fallback: boolean;
}

// ─── Report Fallbacks ─────────────────────────────────────────

const REPORT_FALLBACKS: Record<AiReportType, Record<string, unknown>> = {
  health_summary: {
    status_label: 'attention',
    summary: '暫時無法生成報告，請查看趨勢圖表了解近期數據。',
    reasons: ['AI 服務暫時不可用'],
    suggestions: ['請稍後再試或直接查看健康數據趨勢'],
  },
  trend_analysis: {
    trend_direction: 'stable',
    explanation: '暫時無法分析趨勢，請直接查看趨勢圖表。',
    key_observations: ['AI 服務暫時不可用'],
    suggestions: ['請稍後再試'],
  },
  visit_prep: {
    questions: [{ category: '一般', question: '請諮詢醫師近期健康狀況' }],
    data_to_bring: ['近期量測紀錄'],
    notes: '暫時無法生成看診準備建議，請攜帶近期量測紀錄就診。',
  },
  family_update: {
    greeting: '您好',
    health_update: '暫時無法生成健康近況摘要，請直接查看健康數據。',
    highlights: ['AI 服務暫時不可用'],
    closing: '請稍後再試',
  },
};

const CHAT_FALLBACKS: Record<AiChatTask, Record<string, unknown>> = {
  trend_explanation: {
    explanation: '暫時無法分析趨勢，請直接查看趨勢圖表。',
    key_points: ['AI 服務暫時不可用'],
  },
  family_update: {
    message: '暫時無法生成家人近況，請直接查看健康數據。',
    highlights: ['AI 服務暫時不可用'],
  },
  visit_questions: {
    questions: ['請諮詢醫師近期健康狀況'],
    reminders: ['攜帶近期量測紀錄'],
  },
};

// ─── Core Generation ──────────────────────────────────────────

async function callOpenAI(
  system: string,
  user: string,
  schema: ZodSchema,
): Promise<{
  parsed: Record<string, unknown>;
  raw_response: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
}> {
  const client = getClient();
  const model = getModel();

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content ?? '';
  const parsed = JSON.parse(content) as Record<string, unknown>;

  const validated = schema.parse(parsed);

  return {
    parsed: validated as Record<string, unknown>,
    raw_response: content,
    model: response.model,
    input_tokens: response.usage?.prompt_tokens ?? null,
    output_tokens: response.usage?.completion_tokens ?? null,
  };
}

// ─── Public API ───────────────────────────────────────────────

export async function generateReport(
  type: AiReportType,
  ctx: PromptContext,
  followUp?: FollowUpContext,
): Promise<AiGenerationResult> {
  const { system, user } = buildReportPrompt(type, ctx, followUp);
  const schema = AI_OUTPUT_SCHEMAS[type];
  const debug = shouldDebugLog();

  for (let attempt = 0; attempt <= AI_LIMITS.MAX_RETRIES; attempt++) {
    try {
      const result = await callOpenAI(system, user, schema);
      return {
        output: result.parsed,
        raw_prompt: debug ? user : null,
        raw_response: debug ? result.raw_response : null,
        model: result.model,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        is_fallback: false,
      };
    } catch (err) {
      console.error(`[AI] generateReport attempt ${attempt + 1} failed:`, err);
      if (attempt === AI_LIMITS.MAX_RETRIES) {
        return {
          output: REPORT_FALLBACKS[type],
          raw_prompt: debug ? user : null,
          raw_response: null,
          model: getModel(),
          input_tokens: null,
          output_tokens: null,
          is_fallback: true,
        };
      }
    }
  }

  // Unreachable, but TypeScript needs it
  return {
    output: REPORT_FALLBACKS[type],
    raw_prompt: null,
    raw_response: null,
    model: getModel(),
    input_tokens: null,
    output_tokens: null,
    is_fallback: true,
  };
}

export async function generateChat(
  task: AiChatTask,
  ctx: PromptContext,
  followUp?: FollowUpContext,
): Promise<AiGenerationResult> {
  const { system, user } = buildChatPrompt(task, ctx, followUp);
  const schema = AI_CHAT_OUTPUT_SCHEMAS[task];
  const debug = shouldDebugLog();

  for (let attempt = 0; attempt <= AI_LIMITS.MAX_RETRIES; attempt++) {
    try {
      const result = await callOpenAI(system, user, schema);
      return {
        output: result.parsed,
        raw_prompt: debug ? user : null,
        raw_response: debug ? result.raw_response : null,
        model: result.model,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        is_fallback: false,
      };
    } catch (err) {
      console.error(`[AI] generateChat attempt ${attempt + 1} failed:`, err);
      if (attempt === AI_LIMITS.MAX_RETRIES) {
        return {
          output: CHAT_FALLBACKS[task],
          raw_prompt: debug ? user : null,
          raw_response: null,
          model: getModel(),
          input_tokens: null,
          output_tokens: null,
          is_fallback: true,
        };
      }
    }
  }

  return {
    output: CHAT_FALLBACKS[task],
    raw_prompt: null,
    raw_response: null,
    model: getModel(),
    input_tokens: null,
    output_tokens: null,
    is_fallback: true,
  };
}

/** Build PromptContext from recipient + measurements data */
export function buildPromptContext(
  recipient: { name: string; date_of_birth: Date | null; medical_tags: unknown },
  measurements: Array<{
    type: string;
    systolic: number | null;
    diastolic: number | null;
    glucose_value: { toNumber(): number } | number | null;
    glucose_timing: string | null;
    is_abnormal: boolean;
    measured_at: Date;
  }>,
): PromptContext {
  const age = recipient.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(recipient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const tags = Array.isArray(recipient.medical_tags)
    ? (recipient.medical_tags as string[])
    : [];

  // Group by type
  const byType: Record<string, typeof measurements> = {};
  for (const m of measurements) {
    if (!byType[m.type]) byType[m.type] = [];
    byType[m.type]!.push(m);
  }

  const summaries = Object.entries(byType).map(([type, items]) => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
    );
    const latest = sorted.slice(0, 5).map((m) => {
      if (type === 'blood_pressure') return `${m.systolic}/${m.diastolic}`;
      const gv = m.glucose_value;
      const val = gv && typeof gv === 'object' && 'toNumber' in gv ? gv.toNumber() : gv;
      return `${val}`;
    });

    const earliest = sorted[sorted.length - 1]?.measured_at;
    const latestDate = sorted[0]?.measured_at;
    const period =
      earliest && latestDate
        ? `${new Date(earliest).toLocaleDateString('zh-TW')} ~ ${new Date(latestDate).toLocaleDateString('zh-TW')}`
        : '無資料';

    return {
      type,
      count: items.length,
      abnormal_count: items.filter((m) => m.is_abnormal).length,
      latest_values: latest,
      period,
    };
  });

  return {
    recipient: { name: recipient.name, age, medical_tags: tags },
    measurements: summaries,
  };
}
