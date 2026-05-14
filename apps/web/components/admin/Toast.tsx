/**
 * Toast notification primitive for the admin shell.
 *
 * Replaces the ad-hoc green/red inline banners that every admin page hand-rolls
 * (e.g. `setActionSuccess('已連結')` + 2-second timer). Usage:
 *
 *   const { showToast } = useToast();
 *   showToast({ tone: 'success', message: '已停權' });
 *
 * Lifetime: auto-dismisses after `durationMs` (default 4000); error toasts stay
 * a little longer (6000). User can dismiss manually via the close button.
 *
 * The provider is mounted once in app/admin/layout.tsx so every page below it
 * shares the same viewport and queue.
 */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastInput {
  tone?: ToastTone;
  message: string;
  /** Override auto-dismiss (ms). Set to 0 to disable auto-dismiss. */
  durationMs?: number;
}

interface ToastEntry extends Required<Omit<ToastInput, 'durationMs'>> {
  id: number;
  durationMs: number;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<ToastTone, { container: string; icon: string }> = {
  success: {
    container: 'bg-positive-soft border-positive/30 text-accent-700',
    icon: 'text-positive',
  },
  error: {
    container: 'bg-danger-soft border-danger/30 text-danger',
    icon: 'text-danger',
  },
  info: {
    container: 'bg-brand-50 border-brand-100 text-brand-700',
    icon: 'text-brand-600',
  },
  warning: {
    container: 'bg-warning-soft border-warning/30 text-warning',
    icon: 'text-warning',
  },
};

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 3500,
  info: 3500,
  warning: 5000,
  error: 6000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const tone = input.tone ?? 'info';
      const id = ++idRef.current;
      const durationMs = input.durationMs ?? DEFAULT_DURATION[tone];
      const entry: ToastEntry = {
        id,
        tone,
        message: input.message,
        durationMs,
      };
      setToasts((prev) => [...prev, entry]);
      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    // Capture the timers map on mount so the cleanup uses the stable reference
    // instead of a stale closure read at unmount time.
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex animate-slide-in-right items-start gap-3 rounded-xl border px-4 py-3 shadow-brand-md ${TONE_CLASSES[t.tone].container}`}
          >
            <ToneIcon tone={t.tone} className={`mt-0.5 h-5 w-5 shrink-0 ${TONE_CLASSES[t.tone].icon}`} />
            <p className="flex-1 whitespace-pre-line text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              aria-label="關閉通知"
              onClick={() => dismiss(t.id)}
              className="-mr-1 -mt-1 rounded p-1 text-current opacity-60 transition hover:bg-black/5 hover:opacity-100"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}

function ToneIcon({ tone, className }: { tone: ToastTone; className?: string }) {
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.415L8.414 12.17l7.293-7.293a1 1 0 011 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (tone === 'error') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (tone === 'warning') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625l6.28-10.875zM10 6a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}
