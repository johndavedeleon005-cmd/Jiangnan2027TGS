/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Header, type AppView } from './components/Header';
import { SurveyFlow } from './components/SurveyFlow';
import { DashboardView } from './components/DashboardView';
import { DashboardLockScreen } from './components/DashboardLockScreen';
import {
  buildSurveyCsv,
  getLocalDateString,
  normalizeBranchName,
  type BranchOption,
  type SurveyResponse,
} from './types/survey';
import {
  readStoredDashboardAccount,
  saveStoredDashboardAccount,
  verifyDashboardCredentials,
  type DashboardAccount,
} from './utils/dashboardAuth';
import {
  clearAllSurveyResponses,
  clearBranchSurveyResponses,
  deleteSurveyResponseById,
  getCustomerSurveyUrl,
  loadSurveyResponses,
  subscribeToSurveyResponses,
} from './utils/surveyStorage';

function parseHashLocation(): { path: string; params: URLSearchParams } {
  if (typeof window === 'undefined') {
    return { path: '', params: new URLSearchParams() };
  }
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const qIndex = rawHash.indexOf('?');
  const path = (qIndex >= 0 ? rawHash.slice(0, qIndex) : rawHash)
    .replace(/\/+$/, '')
    .toLowerCase();
  const params = new URLSearchParams(qIndex >= 0 ? rawHash.slice(qIndex + 1) : '');
  return { path, params };
}

function getViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'dashboard';

  const { path } = parseHashLocation();
  if (path === 'survey') return 'survey';
  if (path === 'responses') return 'responses';

  const params = new URLSearchParams(window.location.search);
  const queryView = (params.get('view') || '').toLowerCase();
  if (queryView === 'survey') return 'survey';
  if (queryView === 'responses') return 'responses';

  const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
  if (cleanPath.endsWith('/survey')) return 'survey';
  if (cleanPath.endsWith('/responses')) return 'responses';
  return 'dashboard';
}

function getBranchFromLocation(): BranchOption | '' {
  if (typeof window === 'undefined') return '';
  const { params: hashParams } = parseHashLocation();
  const fromHash = normalizeBranchName(hashParams.get('branch'));
  if (fromHash) return fromHash;

  const searchParams = new URLSearchParams(window.location.search);
  return normalizeBranchName(searchParams.get('branch'));
}

function getHashForView(view: AppView, branch?: BranchOption | null): string {
  const branchQuery = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  if (view === 'survey') return `#/survey${branchQuery}`;
  if (view === 'responses') return `#/responses${branchQuery}`;
  return `#/${branchQuery}`;
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(() => getViewFromLocation());
  const [urlBranch, setUrlBranch] = useState<BranchOption | ''>(() =>
    getBranchFromLocation()
  );
  const [authenticatedAccount, setAuthenticatedAccount] =
    useState<DashboardAccount | null>(() => readStoredDashboardAccount());
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedSurveyLink, setCopiedSurveyLink] = useState<boolean>(false);

  const isDashboardUnlocked = authenticatedAccount !== null;
  const lockedBranch: BranchOption | null =
    authenticatedAccount && authenticatedAccount !== 'HEAD_OFFICE'
      ? authenticatedAccount
      : null;

  useEffect(() => {
    const syncView = () => {
      setActiveView(getViewFromLocation());
      setUrlBranch(getBranchFromLocation());
    };
    window.addEventListener('hashchange', syncView);
    window.addEventListener('popstate', syncView);
    return () => {
      window.removeEventListener('hashchange', syncView);
      window.removeEventListener('popstate', syncView);
    };
  }, []);

  const navigateTo = useCallback((view: AppView, branch?: BranchOption | null) => {
    const nextHash = getHashForView(view, branch);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    setActiveView(view);
    setUrlBranch(branch || '');
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

  const handleUnlockDashboard = useCallback(
    (account: DashboardAccount, enteredPassword: string): boolean => {
      if (verifyDashboardCredentials(account, enteredPassword)) {
        setAuthenticatedAccount(account);
        saveStoredDashboardAccount(account);
        return true;
      }
      return false;
    },
    []
  );

  const handleLockDashboard = useCallback(() => {
    setAuthenticatedAccount(null);
    setResponses([]);
    saveStoredDashboardAccount(null);
  }, []);

  useEffect(() => {
    if (!isDashboardUnlocked) {
      setIsLoading(false);
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
  }, [isDashboardUnlocked]);

  const visibleResponses = useMemo(() => {
    if (!lockedBranch) return responses;
    return responses.filter((r) => r.branch === lockedBranch);
  }, [responses, lockedBranch]);

  const handleSubmitted = (created: SurveyResponse) => {
    setResponses((prev) => {
      if (prev.some((r) => r.id === created.id)) return prev;
      return [created, ...prev];
    });
  };

  const handleDeleteResponse = async (id: string) => {
    if (authenticatedAccount !== 'HEAD_OFFICE') return;
    const ok = await deleteSurveyResponseById(id);
    if (ok) {
      setResponses((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleClearAll = async () => {
    if (authenticatedAccount !== 'HEAD_OFFICE') return;
    const ok = await clearAllSurveyResponses();
    if (ok) {
      setResponses([]);
    }
  };

  const handleClearBranch = async (branch: BranchOption) => {
    if (authenticatedAccount !== 'HEAD_OFFICE') return;
    const ok = await clearBranchSurveyResponses(branch);
    if (ok) {
      setResponses((prev) => prev.filter((r) => r.branch !== branch));
    }
  };

  const handleCopySurveyLink = async (branch?: BranchOption | null) => {
    const targetBranch = lockedBranch ?? branch;
    const url = getCustomerSurveyUrl(targetBranch);
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
      const rowsToExport = customRows ?? visibleResponses;
      const csv = buildSurveyCsv(rowsToExport);
      const defaultPrefix = lockedBranch
        ? `${lockedBranch.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${getLocalDateString(new Date())}`
        : `head-office-${getLocalDateString(new Date())}`;
      const stamp =
        filterLabel && filterLabel !== 'all-dates'
          ? filterLabel
          : defaultPrefix;
      triggerCsvDownload(csv, `tablepulse-surveys-${stamp}.csv`);
    } finally {
      setIsDownloading(false);
    }
  };

  const isLocked = activeView !== 'survey' && !isDashboardUnlocked;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeView={activeView}
        isLocked={isLocked}
        onSelectView={(view) => navigateTo(view, lockedBranch)}
        onDownloadCsv={() => void handleDownloadLatestCsv()}
        onCopySurveyLink={() => void handleCopySurveyLink(lockedBranch)}
        onLockDashboard={handleLockDashboard}
        copiedSurveyLink={copiedSurveyLink}
        responseCount={visibleResponses.length}
        isDownloading={isDownloading}
      />

      <main className="flex-1">
        {activeView === 'survey' ? (
          <SurveyFlow
            initialBranch={urlBranch}
            onSubmitted={handleSubmitted}
          />
        ) : !isDashboardUnlocked ? (
          <DashboardLockScreen
            initialBranch={urlBranch}
            onUnlock={handleUnlockDashboard}
            onOpenSurvey={(branch) => navigateTo('survey', branch)}
          />
        ) : (
          <DashboardView
            mode={activeView}
            initialBranch={lockedBranch ?? urlBranch}
            lockedBranch={lockedBranch}
            responses={visibleResponses}
            isLoading={isLoading}
            error={error}
            onRetry={() => void fetchResponses()}
            onDeleteResponse={handleDeleteResponse}
            onClearAll={handleClearAll}
            onClearBranch={handleClearBranch}
            onStartSurvey={(branch) =>
              navigateTo('survey', lockedBranch ?? branch)
            }
            onCopySurveyLink={(branch) =>
              void handleCopySurveyLink(lockedBranch ?? branch)
            }
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
