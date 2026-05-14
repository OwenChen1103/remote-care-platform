/**
 * Consistent loading & error placeholders.
 * Used inside <main> while pages fetch their initial data.
 */
import { AlertCircle, Loader2 } from 'lucide-react';

export function LoadingState({ label = '載入中...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-ink-500">
      <Loader2 className="h-4 w-4 animate-spin text-brand-500" aria-hidden="true" />
      {label}
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      <p className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-danger/30 bg-white px-3 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
        >
          重試
        </button>
      )}
    </div>
  );
}
