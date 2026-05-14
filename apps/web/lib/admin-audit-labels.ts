/**
 * Admin audit log action key + target type definitions, with display labels.
 *
 * This file owns the canonical list of action keys and target types — the
 * write helper (`admin-audit.ts`) re-exports the type aliases so it doesn't
 * need its own copy. Centralising here lets us use `Record<AdminActionKey, ...>`
 * for the labels map so the TypeScript compiler catches forgotten labels at
 * build time (rather than silently falling through to the key string).
 *
 * Why labels live here (not in admin-audit.ts):
 *   client components need the labels for filter UIs; admin-audit.ts imports
 *   `prisma`, which can't run in the client bundle. Keeping labels pure +
 *   prisma-free isolates the cleanly importable bits.
 */

export type AdminActionKey =
  | 'user.suspend'
  | 'user.unsuspend'
  | 'provider.review'
  | 'recipient.update'
  | 'service_category.toggle'
  | 'service_request.status_change'
  | 'service_request.cancel'
  | 'service_request.propose_candidate'
  | 'preview.access';

export type AdminTargetType =
  | 'user'
  | 'provider'
  | 'recipient'
  | 'service_category'
  | 'service_request';

// `Record<AdminActionKey, string>` — TS will error if a new key is added
// to AdminActionKey without a label here.
export const ADMIN_ACTION_LABELS: Record<AdminActionKey, string> = {
  'user.suspend': '停權使用者',
  'user.unsuspend': '恢復使用者',
  'provider.review': '服務人員審核',
  'recipient.update': '更新被照護者',
  'service_category.toggle': '切換服務類別',
  'service_request.status_change': '需求狀態變更',
  'service_request.cancel': '取消需求',
  'service_request.propose_candidate': '推薦候選人',
  'preview.access': '預覽角色資料',
};

export const ADMIN_TARGET_TYPE_LABELS: Record<AdminTargetType, string> = {
  user: '使用者',
  provider: '服務人員',
  recipient: '被照護者',
  service_category: '服務類別',
  service_request: '服務需求',
};

/**
 * Forgiving runtime lookup: returns the localized label, or echoes back the
 * raw key if the database has an old/unknown value (defensive — should never
 * happen in practice since action keys come from our own writer).
 *
 * Use these instead of direct indexing — the Record types are strictly keyed
 * to catch missing labels at compile time, but DB-sourced strings are typed
 * as plain `string` and would error on direct lookup.
 */
export function getAdminActionLabel(action: string): string {
  return (ADMIN_ACTION_LABELS as Record<string, string>)[action] ?? action;
}

export function getAdminTargetTypeLabel(targetType: string | null | undefined): string | null {
  if (!targetType) return null;
  return (ADMIN_TARGET_TYPE_LABELS as Record<string, string>)[targetType] ?? targetType;
}

/** Filter dropdown options for the audit-log page. */
export const ADMIN_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部動作' },
  ...Object.entries(ADMIN_ACTION_LABELS).map(([value, label]) => ({ value, label })),
];

export const ADMIN_TARGET_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部目標類型' },
  ...Object.entries(ADMIN_TARGET_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];
