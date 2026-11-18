/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Header, type AppView } from './components/Header';
import { SurveyFlow } from './components/SurveyFlow';
import { DashboardView } from './components/DashboardView';
import {
  buildSurveyCsv,
  getLocalDateString,
  type SurveyResponse,
} from './types/survey';

function getViewFromPathname(pathname: string): AppView {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/survey') return 'survey';
  if (clean === '/responses') return 'responses';
  return 'dashboard';
}

function getPathForView(view: AppView): string {
  if (view === 'survey') return '/survey';
  if (view === 'responses') return '/responses';
  return '/';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(() =>
    typeof window !== 'undefined'
      ? getViewFromPathname(window.location.pathname)
      : 'dashboard'
  );
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedSurveyLink, setCopiedSurveyLink] = useState<boolean>(false);

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(getViewFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((view: AppView) => {
    const nextPath = getPathForView(view);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setActiveView(view);
  }, []);

  const fetchResponses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/surveys', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to load survey responses.');
      }
      const data = (await res.json()) as { responses: SurveyResponse[] };
      setResponses(Array.isArray(data.responses) ? data.responses : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach survey server.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView !== 'survey') {
      void fetchResponses();
    }
  }, [activeView, fetchResponses]);

  const handleSubmitted = (created: SurveyResponse) => {
    setResponses((prev) => [created, ...prev]);
  };

  const handleDeleteResponse = async (id: string) => {
    const res = await fetch(`/api/surveys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setResponses((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleClearAll = async () => {
    const res = await fetch('/api/surveys', { method: 'DELETE' });
    if (res.ok) {
      setResponses([]);
    }
  };

  const handleCopySurveyLink = async () => {
    const url = `${window.location.origin}/survey`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopiedSurveyLink(true);
    window.setTimeout(() => setCopiedSurveyLink(false), 2200);
  };

  const triggerCsvDownload = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadLatestCsv = async (
    customRows?: SurveyResponse[],
    filterLabel?: string
  ) => {
    setIsDownloading(true);
    try {
      if (customRows && filterLabel && filterLabel !== 'all-dates') {
        const csv = buildSurveyCsv(customRows);
        triggerCsvDownload(csv, `tablepulse-surveys-${filterLabel}.csv`);
        return;
      }

      const res = await fetch('/api/surveys/export.csv', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('CSV export failed');
      }
      const csvText = await res.text();
      const stamp = getLocalDateString(new Date());
      triggerCsvDownload(csvText, `tablepulse-surveys-${stamp}.csv`);
    } catch {
      const csv = buildSurveyCsv(customRows ?? responses);
      const stamp = getLocalDateString(new Date());
      triggerCsvDownload(csv, `tablepulse-surveys-${stamp}.csv`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeView={activeView}
        onSelectView={navigateTo}
        onDownloadCsv={() => void handleDownloadLatestCsv()}
        onCopySurveyLink={() => void handleCopySurveyLink()}
        copiedSurveyLink={copiedSurveyLink}
        responseCount={responses.length}
        isDownloading={isDownloading}
      />

      <main className="flex-1">
        {activeView === 'survey' ? (
          <SurveyFlow onSubmitted={handleSubmitted} />
        ) : (
          <DashboardView
            mode={activeView}
            responses={responses}
            isLoading={isLoading}
            error={error}
            onRetry={() => void fetchResponses()}
            onDeleteResponse={handleDeleteResponse}
            onClearAll={handleClearAll}
            onStartSurvey={() => navigateTo('survey')}
            onCopySurveyLink={() => void handleCopySurveyLink()}
            copiedSurveyLink={copiedSurveyLink}
            onDownloadCsv={(filtered, label) =>
              void handleDownloadLatestCsv(filtered, label)
            }
            isDownloading={isDownloading}
          />
        )}
      </main>
    </div>
  );
}
