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

import {
  clearAllSurveyResponses,
  deleteSurveyResponseById,
  getCustomerSurveyUrl,
  loadSurveyResponses,
  subscribeToSurveyResponses,
} from './utils/surveyStorage';

function getViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'dashboard';

  const hash = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();
  if (hash === 'survey') return 'survey';
  if (hash === 'responses') return 'responses';

  const params = new URLSearchParams(window.location.search);
  const queryView = (params.get('view') || '').toLowerCase();
  if (queryView === 'survey') return 'survey';
  if (queryView === 'responses') return 'responses';

  const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
  if (cleanPath.endsWith('/survey')) return 'survey';
  if (cleanPath.endsWith('/responses')) return 'responses';
  return 'dashboard';
}

function getHashForView(view: AppView): string {
  if (view === 'survey') return '#/survey';
  if (view === 'responses') return '#/responses';
  return '#/';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(() => getViewFromLocation());
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedSurveyLink, setCopiedSurveyLink] = useState<boolean>(false);

  useEffect(() => {
    const syncView = () => {
      setActiveView(getViewFromLocation());
    };
    window.addEventListener('hashchange', syncView);
    window.addEventListener('popstate', syncView);
    return () => {
      window.removeEventListener('hashchange', syncView);
      window.removeEventListener('popstate', syncView);
    };
  }, []);

  const navigateTo = useCallback((view: AppView) => {
    const nextHash = getHashForView(view);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    setActiveView(view);
  }, []);

  const fetchResponses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await loadSurveyResponses();
      setResponses(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load survey responses.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'survey') {
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeToSurveyResponses(
      (items) => {
        setResponses(items);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || 'Unable to load survey responses.');
        setIsLoading(false);
      }
    );
    return () => {
      unsubscribe();
    };
  }, [activeView]);

  const handleSubmitted = (created: SurveyResponse) => {
    setResponses((prev) => {
      if (prev.some((r) => r.id === created.id)) return prev;
      return [created, ...prev];
    });
  };

  const handleDeleteResponse = async (id: string) => {
    const ok = await deleteSurveyResponseById(id);
    if (ok) {
      setResponses((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleClearAll = async () => {
    const ok = await clearAllSurveyResponses();
    if (ok) {
      setResponses([]);
    }
  };

  const handleCopySurveyLink = async () => {
    const url = getCustomerSurveyUrl();
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
      const rowsToExport = customRows ?? responses;
      const csv = buildSurveyCsv(rowsToExport);
      const stamp =
        filterLabel && filterLabel !== 'all-dates'
          ? filterLabel
          : getLocalDateString(new Date());
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
