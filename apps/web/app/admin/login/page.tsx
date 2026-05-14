'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Lock, Mail } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? '登入失敗');
        setLoading(false);
        return;
      }

      if (data.data.user.role !== 'admin') {
        setError('此帳號無管理員權限');
        setLoading(false);
        return;
      }

      // Set httpOnly cookie via dedicated endpoint
      await fetch('/api/v1/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.data.token }),
      });

      router.push('/admin/dashboard');
    } catch {
      setError('網路錯誤，請稍後再試');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle md:flex-row">
      {/* Brand visual panel — pure abstract icon centred on a gradient.
          Cooler / deeper gradient (brand-700 → brand-500 → accent-600) so the
          panel feels calm and professional rather than saturated. */}
      <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-500 to-accent-600 p-8 md:flex-1 md:p-12">
        {/* Soft decorative orbs for depth. */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent-300/20 blur-3xl" aria-hidden="true" />

        {/* The icon — large, fully opaque, centre stage. */}
        <Image
          src="/brand/whocares-icon.png"
          alt="WhoCares"
          width={400}
          height={400}
          priority
          className="relative h-auto w-2/3 max-w-sm select-none drop-shadow-2xl"
        />
      </div>

      {/* Form panel — content sits in the upper-third (not dead-centre) so
          the eye naturally lands on the title. Achieved by adding generous
          bottom padding to offset the visual centre upward. */}
      <div className="flex items-center justify-center p-6 md:flex-1 md:p-12 md:pb-32">
        <div className="w-full max-w-md">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-ink-900">登入管理後台</h1>
            <p className="mt-1.5 text-sm text-ink-500">請使用您的管理員帳號繼續</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-900">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-outline bg-white py-2.5 pl-10 pr-3 text-sm shadow-brand-low transition-colors placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="admin@remotecare.dev"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-900">
                密碼
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-outline bg-white py-2.5 pl-10 pr-3 text-sm shadow-brand-low transition-colors placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-brand-md transition-all duration-150 hover:bg-brand-600 hover:shadow-brand-high active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '登入中...' : '登入'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
