/**
 * Display labels and formatters for ServiceRequest.metadata fields.
 *
 * Single source of truth for rendering metadata across mobile + admin pages.
 * The metadata Json field accepts any keys (z.record(z.unknown())) — this map
 * defines which keys are renderable and how.
 *
 * Used by:
 *   - apps/mobile/app/(tabs)/services/[requestId].tsx (caregiver/patient detail)
 *   - apps/mobile/app/(tabs)/services/provider-task-detail.tsx (provider task detail)
 *   - apps/web/app/admin/service-requests/[id]/page.tsx (admin detail)
 *
 * Keys must match what new-request.tsx writes to metadata. If you add a new
 * metadata key in the request form, add it here too — otherwise it's collected
 * but never displayed.
 */

export interface ServiceMetadataLabel {
  /** Traditional Chinese display label. */
  label: string;
  /** Optional formatter that converts the raw value to a display string. */
  format?: (v: unknown) => string;
}

const sessionLabels: Record<string, string> = {
  morning: '早診',
  afternoon: '午診',
  evening: '夜診',
};

const genderLabels: Record<string, string> = {
  female: '女性',
  male: '男性',
};

const exerciseTypeLabels: Record<string, string> = {
  post_surgery: '術後保養',
  muscle_training: '肌力訓練',
  general: '一般運動',
};

export const SERVICE_METADATA_LABELS: Record<string, ServiceMetadataLabel> = {
  // ── Escort visit (陪診) ──
  department: { label: '掛號科別' },
  doctor_name: { label: '醫師姓名' },
  registration_number: { label: '掛號號碼' },
  session: {
    label: '診別',
    format: (v) => sessionLabels[v as string] ?? String(v),
  },
  needs_pickup: {
    label: '需要接送',
    format: (v) => (v ? '是' : '否'),
  },
  preferred_gender: {
    label: '服務人員性別偏好',
    format: (v) => {
      if (!v) return '不限';
      return genderLabels[v as string] ?? '不限';
    },
  },
  preferred_certifications: {
    label: '證照偏好',
    format: (v) => (Array.isArray(v) ? (v as string[]).join('、') : String(v)),
  },

  // ── Exercise (運動養生) ──
  exercise_type: {
    label: '運動類型',
    format: (v) => exerciseTypeLabels[v as string] ?? String(v),
  },

  // ── Cleaning (居家打掃) ──
  space_size: {
    label: '空間坪數',
    format: (v) => `${v} 坪`,
  },
  has_pets: {
    label: '有養寵物',
    format: (v) => (v ? '是' : '否'),
  },
};

export interface FormattedMetadataEntry {
  key: string;
  label: string;
  value: string;
}

/**
 * Format a single metadata key/value pair using SERVICE_METADATA_LABELS.
 * Returns null if the key is unknown — caller decides whether to skip or render raw.
 */
export function formatMetadataEntry(key: string, value: unknown): FormattedMetadataEntry | null {
  const entry = SERVICE_METADATA_LABELS[key];
  if (!entry) return null;
  // Skip empty / nullish values (writer may emit `if (gender) metadata.preferred_gender = gender;`
  // so empty string never reaches us; but defensive against future writers).
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;
  const formatted = entry.format ? entry.format(value) : String(value);
  return { key, label: entry.label, value: formatted };
}

/**
 * Format an entire metadata object into a renderable list.
 * Filters out unknown keys + empty values. Order follows SERVICE_METADATA_LABELS keys
 * (so render order is stable regardless of object key insertion order).
 */
export function formatMetadataEntries(metadata: Record<string, unknown> | null | undefined): FormattedMetadataEntry[] {
  if (!metadata) return [];
  const ordered: FormattedMetadataEntry[] = [];
  for (const key of Object.keys(SERVICE_METADATA_LABELS)) {
    if (key in metadata) {
      const entry = formatMetadataEntry(key, metadata[key]);
      if (entry) ordered.push(entry);
    }
  }
  return ordered;
}
