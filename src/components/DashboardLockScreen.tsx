import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { BrandLogo } from './Icons';

interface DashboardLockScreenProps {
  onUnlock: (password: string) => boolean;
  onOpenSurvey: () => void;
}

export function DashboardLockScreen({
  onUnlock,
  onOpenSurvey,
}: DashboardLockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the dashboard password.');
      return;
    }
    const ok = onUnlock(password);
    if (!ok) {
      setError('Incorrect password. Please try again.');
    } else {
      setError(null);
      setPassword('');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <BrandLogo sizeClass="w-11 h-11" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Dashboard Access
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Jiang Nan Traffic Generation Survey
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="dashboard-password"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Enter Password
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="dashboard-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="current-password"
                autoFocus
                placeholder="Enter dashboard password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'dashboard-password-error' : undefined}
                className={`w-full h-11 pl-10 pr-11 rounded-xl border bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-red-500 focus:border-red-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {error && (
              <p
                id="dashboard-password-error"
                role="alert"
                className="mt-2 text-xs font-medium text-red-600"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Unlock Dashboard
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Taking the customer survey?</span>
          <button
            type="button"
            onClick={onOpenSurvey}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-red-600 transition-colors whitespace-nowrap"
          >
            <span>Open Survey</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
