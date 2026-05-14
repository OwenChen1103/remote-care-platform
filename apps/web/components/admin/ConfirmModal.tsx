/**
 * Accessible confirmation modal for destructive admin actions.
 *
 * Behaviour:
 *   - Backdrop click + ESC dismiss (unless `submitting` is true)
 *   - Confirm button enters a `submitting` state if `onConfirm` returns a Promise
 *   - Focus is moved to the cancel button on open (safer default for destructive ops)
 *   - Body scroll is locked while open
 *   - Backdrop fades in; card scales in (matches Toast / audit-log modal feel)
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export type ConfirmTone = 'danger' | 'warning' | 'primary';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** When true, disables interactive controls and shows a loading label on confirm. */
  submitting?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const TONE_BUTTON: Record<ConfirmTone, string> = {
  danger:  'bg-danger text-white hover:bg-rose-600 focus-visible:ring-danger',
  warning: 'bg-warning text-white hover:bg-orange-500 focus-visible:ring-warning',
  primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500',
};

const TONE_ICON_WRAP: Record<ConfirmTone, string> = {
  danger:  'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  primary: 'bg-brand-50 text-brand-600',
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = '確認',
  cancelLabel = '取消',
  tone = 'primary',
  submitting: externalSubmitting,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const submitting = externalSubmitting ?? internalSubmitting;

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    setInternalSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setInternalSubmitting(false);
    }
  }, [onConfirm, submitting]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, submitting, onClose]);

  if (!open) return null;

  const Icon = (tone === 'danger' || tone === 'warning') ? AlertTriangle : Info;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby={description ? 'confirm-modal-description' : undefined}
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={() => { if (!submitting) onClose(); }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-brand-high">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_ICON_WRAP[tone]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 id="confirm-modal-title" className="text-base font-semibold text-ink-900">
                {title}
              </h3>
              {description && (
                <p id="confirm-modal-description" className="mt-2 whitespace-pre-line text-sm text-ink-700">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-outline bg-surface-subtle px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-xl border border-outline bg-white px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleConfirm()}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-brand-md transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${TONE_BUTTON[tone]}`}
          >
            {submitting ? '處理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
