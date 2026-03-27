import type { AiReportType, AiChatTask } from '@remote-care/shared';

interface RecipientContext {
  name: string;
  age: number | null;
  medical_tags: string[];
}

interface MeasurementSummary {
  type: string;
  count: number;
  abnormal_count: number;
  latest_values: string[];
  period: string;
}

export interface PromptContext {
  recipient: RecipientContext;
  measurements: MeasurementSummary[];
}

const SYSTEM_RULES = `你是一位台灣家庭健康關懷助理，幫助遠距的家人了解長輩的近期健康狀況。
語氣要求：像家人之間的日常關心，溫暖但不誇張，清楚但不臨床。

嚴格規則：
- 不可提及任何藥物名稱或劑量
- 不可做出診斷性陳述（如「您患有XXX疾病」）
- 不可建議處方或治療方案
- 不可提供緊急醫療建議
- 不可做出心理健康診斷
- 不可使用「病史」「數據異常」「分析結果顯示」等臨床用語
- 建議用「建議安排醫師評估」代替「建議諮詢醫師」
- 摘要不可重複被照護者的姓名、年齡、已知健康標籤等基本資料（這些已在介面上顯示）
- 回覆必須使用繁體中文
- 回覆必須是有效的 JSON 格式`;

function formatMeasurementContext(measurements: MeasurementSummary[]): string {
  if (measurements.length === 0) return '目前無量測資料。';
  return measurements
    .map((m) => {
      const typeLabel = m.type === 'blood_pressure' ? '血壓' : '血糖';
      return `${typeLabel}：共 ${m.count} 筆（異常 ${m.abnormal_count} 筆），最近數值：${m.latest_values.join('、')}，期間：${m.period}`;
    })
    .join('\n');
}

// ─── Report Prompts ───────────────────────────────────────────

const REPORT_PROMPTS: Record<AiReportType, (ctx: PromptContext) => string> = {
  health_summary: (ctx) => `請根據以下量測資料，產生一份讓家人安心的健康近況摘要。

背景資訊（僅供判斷參考，不要在回覆中重複這些資料）：
- 姓名：${ctx.recipient.name}${ctx.recipient.age ? `，${ctx.recipient.age} 歲` : ''}
- 已知健康狀況：${ctx.recipient.medical_tags.length > 0 ? ctx.recipient.medical_tags.join('、') : '無'}

量測資料：
${formatMeasurementContext(ctx.measurements)}

語氣要求：
- 像在跟家人說話，不像醫療報告
- summary 直接從觀察開始，例如「近期血壓控制良好」「今天的血糖略高」
- 不要開頭用姓名或年齡
- 用「建議持續留意」「建議安排醫師評估」代替「建議諮詢醫師」

請以 JSON 格式回覆，包含以下欄位：
- status_label: "stable"（穩定）、"attention"（需注意）或 "consult_doctor"（建議就醫）
- summary: 1-2 句簡短近況（最多100字，不重複個人資料）
- reasons: 最近觀察陣列（1-5項，每項最多200字）
- suggestions: 溫馨提醒陣列（1-5項，每項最多200字）`,

  trend_analysis: (ctx) => `請根據以下量測趨勢，用溫暖的語氣說明近期變化。

背景資訊（僅供判斷參考，不要在回覆中重複）：
- 姓名：${ctx.recipient.name}${ctx.recipient.age ? `，${ctx.recipient.age} 歲` : ''}
- 已知健康狀況：${ctx.recipient.medical_tags.length > 0 ? ctx.recipient.medical_tags.join('、') : '無'}

量測資料：
${formatMeasurementContext(ctx.measurements)}

請以 JSON 格式回覆，包含以下欄位：
- trend_direction: "improving"（改善中）、"stable"（穩定）或 "worsening"（需留意）
- explanation: 趨勢說明（最多300字，用自然口語）
- key_observations: 近期觀察陣列（1-5項）
- suggestions: 溫馨提醒陣列（1-5項）`,

  visit_prep: (ctx) => `請根據以下量測資料，幫忙準備下次看診的問題和提醒。

背景資訊（僅供判斷參考，不要在回覆中重複）：
- 姓名：${ctx.recipient.name}${ctx.recipient.age ? `，${ctx.recipient.age} 歲` : ''}
- 已知健康狀況：${ctx.recipient.medical_tags.length > 0 ? ctx.recipient.medical_tags.join('、') : '無'}

量測資料：
${formatMeasurementContext(ctx.measurements)}

請以 JSON 格式回覆，包含以下欄位：
- questions: 建議問醫師的問題陣列（1-10項），每項包含 category（類別）和 question（問題）
- data_to_bring: 看診時記得帶的東西陣列（1-5項）
- notes: 貼心提醒（最多300字，用口語化語氣）`,

  family_update: (ctx) => `請根據以下量測資料，寫一段可以直接傳給其他家人的近況訊息。

背景資訊（僅供判斷參考，不要在回覆中重複姓名年齡等）：
- 姓名：${ctx.recipient.name}${ctx.recipient.age ? `，${ctx.recipient.age} 歲` : ''}
- 已知健康狀況：${ctx.recipient.medical_tags.length > 0 ? ctx.recipient.medical_tags.join('、') : '無'}

量測資料：
${formatMeasurementContext(ctx.measurements)}

語氣：像在家族群組裡跟兄弟姊妹報平安，溫暖自然。

請以 JSON 格式回覆，包含以下欄位：
- greeting: 開頭問候（最多50字）
- health_update: 近況說明（最多300字）
- highlights: 重點摘要陣列（1-5項）
- closing: 結尾語（最多100字）`,
};

// ─── Chat Prompts ─────────────────────────────────────────────

const CHAT_PROMPTS: Record<AiChatTask, (ctx: PromptContext) => string> = {
  trend_explanation: (ctx) => `請用口語化的方式，簡要說明近期的健康量測趨勢。

被照護者：${ctx.recipient.name}
量測資料：
${formatMeasurementContext(ctx.measurements)}

請以 JSON 格式回覆，包含：
- explanation: 趨勢說明（最多500字，語氣自然溫暖）
- key_points: 重點觀察陣列（1-5項）`,

  family_update: (ctx) => `請寫一段可以直接傳到家族群組的近況訊息，語氣像在跟家人報平安。

被照護者：${ctx.recipient.name}
量測資料：
${formatMeasurementContext(ctx.measurements)}

請以 JSON 格式回覆，包含：
- message: 給家人的訊息（最多500字）
- highlights: 重點摘要陣列（1-5項）`,

  visit_questions: (ctx) => `請根據近期量測資料，幫忙準備下次看診可以問的問題。

被照護者：${ctx.recipient.name}
量測資料：
${formatMeasurementContext(ctx.measurements)}

請以 JSON 格式回覆，包含：
- questions: 建議問題陣列（1-10項）
- reminders: 看診提醒陣列（1-5項）`,
};

export interface FollowUpContext {
  user_message: string;
  routed_task: string;
  response_summary: string;
}

function formatFollowUpBlock(prev: FollowUpContext): string {
  return `\n\n前次互動（供參考）：
使用者問：「${prev.user_message}」
助理回覆摘要：${prev.response_summary}

使用者現在接著詢問相關問題，請參考上述脈絡回覆。`;
}

export function buildReportPrompt(type: AiReportType, ctx: PromptContext, followUp?: FollowUpContext): { system: string; user: string } {
  let user = REPORT_PROMPTS[type](ctx);
  if (followUp) user += formatFollowUpBlock(followUp);
  return { system: SYSTEM_RULES, user };
}

export function buildChatPrompt(task: AiChatTask, ctx: PromptContext, followUp?: FollowUpContext): { system: string; user: string } {
  let user = CHAT_PROMPTS[task](ctx);
  if (followUp) user += formatFollowUpBlock(followUp);
  return { system: SYSTEM_RULES, user };
}
