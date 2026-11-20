import React from 'react';
import { Check, Copy, Download, KeyRound, Lock } from 'lucide-react';
import { BrandLogo } from './Icons';

export type AppView = 'survey' | 'dashboard' | 'responses' | 'codes';

interface HeaderProps {
  activeView: AppView;
  isLocked: boolean;
  isHeadOffice: boolean;
  activeCodeCount: number;
  onSelectView: (view: AppView) => void;
  onDownloadCsv: () => void;
  onCopySurveyLink: () => void;
  onLockDashboard: () => void;
  copiedSurveyLink: boolean;
  responseCount: number;
  isDownloading: boolean;
}

export function Header({
  activeView,
  isLocked,
  isHeadOffice,
  activeCodeCount,
  onSelectView,
  onDownloadCsv,
  onCopySurveyLink,
  onLockDashboard,
  copiedSurveyLink,
  responseCount,
  isDownloading,
}: HeaderProps) {
  if (activeView === 'survey' || isLocked) {
    return (
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <BrandLogo sizeClass="w-9 h-9 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              Jiang Nan
            </span>
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            {activeView === 'survey'
              ? 'Marketing Research Survey'
              : 'Protected Dashboard'}
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark & Logo */}
        <button
          type="button"
          onClick={() => onSelectView('dashboard')}
          className="inline-flex items-center gap-2.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-md px-1 -ml-1"
        >
          <BrandLogo sizeClass="w-9 h-9" />
          <span>Jiang Nan</span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-4 sm:gap-7 text-sm font-medium"
        >
          <button
            type="button"
            onClick={() => onSelectView('dashboard')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 min-h-[40px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
              activeView === 'dashboard'
                ? 'border-red-500 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onSelectView('responses')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 min-h-[40px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
              activeView === 'responses'
                ? 'border-red-500 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Responses</span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {responseCount}
            </span>
          </button>
          {isHeadOffice && (
            <button
              type="button"
              onClick={() => onSelectView('codes')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 min-h-[40px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                activeView === 'codes'
                  ? 'border-red-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
              <span>Survey Codes</span>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {activeCodeCount}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onCopySurveyLink}
            className="hidden sm:inline-flex items-center gap-1.5 py-1.5 border-b-2 border-transparent text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            {copiedSurveyLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span className="text-red-600 font-medium">Copied Link</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Copy Survey Link</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onLockDashboard}
            className="inline-flex items-center gap-1.5 py-1.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onDownloadCsv}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Download CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
