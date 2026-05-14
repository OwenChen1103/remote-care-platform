/**
 * Status badges backed by the shared status-display constants
 * (`packages/shared/src/constants/status-display.ts`).
 *
 * Each admin page used to maintain its own STATUS_LABELS map (with subtly
 * different colours — e.g. service-requests/page.tsx had caregiver_confirmed
 * as indigo while shared defines it as cyan). Centralising eliminates drift.
 *
 * Falls back to a neutral grey pill if the status is unknown — never blanks
 * out, never throws.
 */
import {
  PROVIDER_AVAILABILITY_DISPLAY,
  PROVIDER_REVIEW_STATUS_DISPLAY,
  SERVICE_REQUEST_STATUS_DISPLAY,
  type StatusDisplayConfig,
} from '@remote-care/shared';

const FALLBACK: StatusDisplayConfig = {
  label: '',
  color: '#374151',
  bg: '#F3F4F6',
  twClasses: 'bg-gray-100 text-gray-600',
};

interface BadgeProps {
  size?: 'sm' | 'md';
}

/**
 * All badges share the same shape: rounded pill, faint colored bg, matching
 * text. A small status dot at the leading edge adds visual rhythm consistent
 * with the mobile app's status patterns.
 */
function renderBadge(config: StatusDisplayConfig, fallbackKey: string, size: 'sm' | 'md' = 'sm') {
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padding} ${config.twClasses}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
        aria-hidden="true"
      />
      {config.label || fallbackKey}
    </span>
  );
}

export function ServiceRequestStatusBadge({ status, size }: { status: string } & BadgeProps) {
  const config = SERVICE_REQUEST_STATUS_DISPLAY[status as keyof typeof SERVICE_REQUEST_STATUS_DISPLAY] ?? FALLBACK;
  return renderBadge(config, status, size);
}

export function ProviderReviewStatusBadge({ status, size }: { status: string } & BadgeProps) {
  const config = PROVIDER_REVIEW_STATUS_DISPLAY[status as keyof typeof PROVIDER_REVIEW_STATUS_DISPLAY] ?? FALLBACK;
  return renderBadge(config, status, size);
}

export function ProviderAvailabilityBadge({ status, size }: { status: string } & BadgeProps) {
  const config = PROVIDER_AVAILABILITY_DISPLAY[status] ?? FALLBACK;
  return renderBadge(config, status, size);
}

interface SuspensionBadgeProps extends BadgeProps {
  /** ISO timestamp string when the user was suspended; null = active. */
  suspendedAt: string | null;
}

export function SuspensionBadge({ suspendedAt, size = 'sm' }: SuspensionBadgeProps) {
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  if (suspendedAt === null) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-positive-soft font-medium text-positive ${padding}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
        使用中
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-danger-soft font-medium text-danger ${padding}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
      已停權（{new Date(suspendedAt).toLocaleDateString('zh-TW')}）
    </span>
  );
}

interface BooleanBadgeProps extends BadgeProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function ActiveBadge({
  active,
  activeLabel = '啟用',
  inactiveLabel = '停用',
  size = 'sm',
}: BooleanBadgeProps) {
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  if (active) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-positive-soft font-medium text-positive ${padding}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
        {activeLabel}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-alt font-medium text-ink-500 ${padding}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-ink-300" aria-hidden="true" />
      {inactiveLabel}
    </span>
  );
}
