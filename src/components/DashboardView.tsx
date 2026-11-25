import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  Car,
  Check,
  ChevronRight,
  ClipboardList,
  Compass,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Heart,
  KeyRound,
  Layers,
  Link2,
  MapPin,
  Printer,
  Search,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BRANCH_OPTIONS,
  buildSurveyCsv,
  getLocalDateString,
  getTransportCategory,
  type AgeGroupOption,
  type BranchOption,
  type GenderOption,
  type OccupationOption,
  type RelationshipStatusOption,
  type SurveyResponse,
  type TransportModeOption,
  type VisitFrequencyOption,
} from '../types/survey';
import {
  AgeGroupIcon,
  BrandLogo,
  CompanionIcon,
  GenderIcon,
  LocationIcon,
  OccupationIcon,
  PaymentMethodIcon,
  RelationshipIcon,
  Sparkles,
  TransportIcon,
  VisitFrequencyIcon,
} from './Icons';
import { getCustomerSurveyUrl } from '../utils/surveyStorage';

export type DatePreset = 'all' | 'today' | '7days' | 'custom';
export type DashboardScope = 'all' | 'branch';

interface DashboardViewProps {
  mode: 'dashboard' | 'responses';
  initialBranch?: BranchOption | '';
  lockedBranch?: BranchOption | null;
  responses: SurveyResponse[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onDeleteResponse: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onClearBranch: (branch: BranchOption) => Promise<void>;
  onStartSurvey: (branch?: BranchOption | null) => void;
  onCopySurveyLink: (branch?: BranchOption | null) => void;
  copiedSurveyLink: boolean;
  onDownloadCsv: (filtered: SurveyResponse[], filterLabel: string) => void;
  isDownloading: boolean;
  onOpenSurveyCodes?: () => void;
  activeCodeCount?: number;
}

function BreakdownBarList({
  title,
  headerIcon,
  items,
  total,
  renderIcon,
}: {
  title: string;
  headerIcon?: React.ReactNode;
  items: { label: string; count: number; sublabel?: string }[];
  total: number;
  renderIcon?: (label: string) => React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 print-avoid-break print:rounded-xl print:p-4 print:border-slate-300">
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 print:pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {headerIcon && (
            <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              {headerIcon}
            </span>
          )}
          <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
        </div>
        <span className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
          {total} total
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {items.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <li key={item.label}>
                <div className="flex items-center justify-between gap-3 text-xs sm:text-sm mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 text-slate-800 font-medium">
                    {renderIcon && (
                      <span className="text-slate-500 shrink-0">
                        {renderIcon(item.label)}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-slate-400 font-normal shrink-0">
                        · {item.sublabel}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                    <span className="font-semibold text-slate-900">{item.count}</span>
                    <span className="text-slate-400 ml-1.5">({pct}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function countBy<T extends string>(
  list: SurveyResponse[],
  getter: (r: SurveyResponse) => T
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of list) {
    const key = getter(item) || 'Unspecified';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

interface DailyTrendPoint {
  dateStr: string;
  axisLabel: string;
  fullDate: string;
  submissions: number;
  guests: number;
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyTrendPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md px-3.5 py-2.5 text-xs">
      <div className="font-semibold text-slate-900 mb-1.5">{point.fullDate}</div>
      <div className="flex items-center justify-between gap-4 text-slate-600">
        <span>Submissions</span>
        <span className="font-mono font-semibold text-red-600 tabular-nums">
          {point.submissions}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 mt-0.5">
        <span>Total Guests</span>
        <span className="font-mono font-semibold text-slate-900 tabular-nums">
          {point.guests} pax
        </span>
      </div>
    </div>
  );
}

export function DashboardView({
  mode,
  initialBranch = '',
  lockedBranch = null,
  responses,
  isLoading,
  error,
  onRetry,
  onDeleteResponse,
  onClearAll,
  onClearBranch,
  onStartSurvey,
  onCopySurveyLink,
  copiedSurveyLink,
  onDownloadCsv,
  isDownloading,
  onOpenSurveyCodes,
  activeCodeCount = 0,
}: DashboardViewProps) {
  const isHeadOffice = !lockedBranch;
  const [scope, setScope] = useState<DashboardScope>(() =>
    lockedBranch || initialBranch ? 'branch' : 'all'
  );
  const [selectedBranch, setSelectedBranch] = useState<BranchOption>(
    () => lockedBranch || initialBranch || BRANCH_OPTIONS[0]
  );
  const [branchPickerQuery, setBranchPickerQuery] = useState('');
  const [showActiveBranchesOnly, setShowActiveBranchesOnly] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDate, setCustomDate] = useState<string>(getLocalDateString(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [trendMetric, setTrendMetric] = useState<'submissions' | 'guests'>('submissions');
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (lockedBranch) {
      setScope('branch');
      setSelectedBranch(lockedBranch);
    } else if (initialBranch) {
      setScope('branch');
      setSelectedBranch(initialBranch);
    }
  }, [lockedBranch, initialBranch]);

  const effectiveScope: DashboardScope = lockedBranch ? 'branch' : scope;
  const activeBranch: BranchOption | null =
    lockedBranch ?? (effectiveScope === 'branch' ? selectedBranch : null);

  const handleOpenBranchDashboard = (branch: BranchOption) => {
    if (lockedBranch) return;
    setSelectedBranch(branch);
    setScope('branch');
    setConfirmClear(false);
  };

  const handleOpenWholeDashboard = () => {
    if (lockedBranch) return;
    setScope('all');
    setConfirmClear(false);
  };

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const todayReadable = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return getLocalDateString(d);
  }, []);

  // Responses filtered by date & search (across all branches) — used for Whole Network branch summary table
  const dateAndSearchFilteredAll = useMemo(() => {
    let list = [...responses];

    if (datePreset === 'today') {
      list = list.filter((r) => r.submittedDate === todayStr);
    } else if (datePreset === '7days') {
      list = list.filter((r) => r.submittedDate >= sevenDaysAgoStr);
    } else if (datePreset === 'custom' && customDate) {
      list = list.filter((r) => r.submittedDate === customDate);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.branch || 'unassigned').toLowerCase().includes(q) ||
          (r.surveyCode || '').toLowerCase().includes(q) ||
          (r.name || 'anonymous').toLowerCase().includes(q) ||
          r.gender.toLowerCase().includes(q) ||
          r.ageGroup.toLowerCase().includes(q) ||
          r.diningWith.toLowerCase().includes(q) ||
          (r.visitFrequency || '').toLowerCase().includes(q) ||
          r.transportMode.toLowerCase().includes(q) ||
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.spendPerPax.toLowerCase().includes(q) ||
          (r.orderedTakeout && 'takeout'.includes(q)) ||
          (r.paymentMethod || '').toLowerCase().includes(q) ||
          r.submittedDate.includes(q)
      );
    }

    return list;
  }, [responses, datePreset, customDate, searchQuery, todayStr, sevenDaysAgoStr]);

  // All-time responses for the active scope (Whole vs Selected Branch)
  const scopedAllResponses = useMemo(() => {
    if (!activeBranch) return responses;
    return responses.filter((r) => r.branch === activeBranch);
  }, [responses, activeBranch]);

  // Filtered responses for the active scope (Whole vs Selected Branch)
  const filteredResponses = useMemo(() => {
    if (!activeBranch) return dateAndSearchFilteredAll;
    return dateAndSearchFilteredAll.filter((r) => r.branch === activeBranch);
  }, [dateAndSearchFilteredAll, activeBranch]);

  // Live all-time count per branch for the Branch Switcher pills/dropdown
  const branchTotalCounts = useMemo(() => {
    const counts = new Map<BranchOption, number>();
    for (const b of BRANCH_OPTIONS) {
      counts.set(b, 0);
    }
    for (const r of responses) {
      if (r.branch && counts.has(r.branch)) {
        counts.set(r.branch, (counts.get(r.branch) ?? 0) + 1);
      }
    }
    return counts;
  }, [responses]);

  const activeBranchesAllTimeCount = useMemo(() => {
    let active = 0;
    for (const b of BRANCH_OPTIONS) {
      if ((branchTotalCounts.get(b) ?? 0) > 0) active += 1;
    }
    return active;
  }, [branchTotalCounts]);

  // Per-branch performance summary (for the Whole Network Dashboard)
  const branchOverview = useMemo(() => {
    const totalCount = dateAndSearchFilteredAll.length;
    const rows = BRANCH_OPTIONS.map((branch) => {
      const items = dateAndSearchFilteredAll.filter((r) => r.branch === branch);
      const count = items.length;
      const totalPax = items.reduce((acc, r) => acc + r.partySize, 0);
      const avgPax = count > 0 ? (totalPax / count).toFixed(1) : '0.0';
      const topSpend = countBy(items, (r) => r.spendPerPax)[0]?.label ?? '—';
      const topTransport = countBy(items, (r) => r.transportMode)[0]?.label ?? '—';
      const sharePct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const latestDate = items[0]?.submittedDate ?? '—';

      return {
        branch,
        count,
        totalPax,
        avgPax,
        topSpend,
        topTransport,
        sharePct,
        latestDate,
      };
    });

    const unassignedItems = dateAndSearchFilteredAll.filter((r) => !r.branch);
    const unassignedCount = unassignedItems.length;
    const unassignedPax = unassignedItems.reduce((acc, r) => acc + r.partySize, 0);
    const activeCount = rows.filter((row) => row.count > 0).length;

    const sortedRows = [...rows].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return BRANCH_OPTIONS.indexOf(a.branch) - BRANCH_OPTIONS.indexOf(b.branch);
    });

    return {
      rows: sortedRows,
      activeCount,
      unassignedCount,
      unassignedPax,
      totalCount,
    };
  }, [dateAndSearchFilteredAll]);

  const filteredOverviewRows = useMemo(() => {
    const q = branchPickerQuery.trim().toUpperCase();
    return branchOverview.rows.filter((row) => {
      if (showActiveBranchesOnly && row.count === 0) return false;
      if (q && !row.branch.includes(q)) return false;
      return true;
    });
  }, [branchOverview.rows, showActiveBranchesOnly, branchPickerQuery]);

  const filteredSwitcherBranches = useMemo(() => {
    const q = branchPickerQuery.trim().toUpperCase();
    if (!q) return BRANCH_OPTIONS;
    return BRANCH_OPTIONS.filter((b) => b.includes(q));
  }, [branchPickerQuery]);

  const metrics = useMemo(() => {
    const count = filteredResponses.length;
    const totalPax = filteredResponses.reduce((acc, r) => acc + r.partySize, 0);
    const avgPax = count > 0 ? (totalPax / count).toFixed(1) : '0.0';

    const transportCounts = countBy(filteredResponses, (r) => r.transportMode);
    const topTransport = transportCounts[0]?.label ?? '—';

    const spendCounts = countBy(filteredResponses, (r) => r.spendPerPax);
    const topSpend = spendCounts[0]?.label ?? '—';

    const latestDate = filteredResponses[0]?.submittedDate ?? '—';

    return {
      count,
      totalPax,
      avgPax,
      topTransport,
      topSpend,
      latestDate,
    };
  }, [filteredResponses]);

  const last7DaysTrend = useMemo(() => {
    let source = scopedAllResponses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      source = scopedAllResponses.filter(
        (r) =>
          (r.branch || 'unassigned').toLowerCase().includes(q) ||
          (r.surveyCode || '').toLowerCase().includes(q) ||
          (r.name || 'anonymous').toLowerCase().includes(q) ||
          r.gender.toLowerCase().includes(q) ||
          r.ageGroup.toLowerCase().includes(q) ||
          r.diningWith.toLowerCase().includes(q) ||
          (r.visitFrequency || '').toLowerCase().includes(q) ||
          r.transportMode.toLowerCase().includes(q) ||
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.spendPerPax.toLowerCase().includes(q) ||
          (r.orderedTakeout && 'takeout'.includes(q)) ||
          (r.paymentMethod || '').toLowerCase().includes(q) ||
          r.submittedDate.includes(q)
      );
    }

    const byDate = new Map<string, { submissions: number; guests: number }>();
    for (const r of source) {
      const existing = byDate.get(r.submittedDate) ?? { submissions: 0, guests: 0 };
      existing.submissions += 1;
      existing.guests += r.partySize;
      byDate.set(r.submittedDate, existing);
    }

    const points: DailyTrendPoint[] = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const dateStr = getLocalDateString(d);
      const entry = byDate.get(dateStr) ?? { submissions: 0, guests: 0 };
      points.push({
        dateStr,
        axisLabel: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        fullDate: d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        submissions: entry.submissions,
        guests: entry.guests,
      });
    }

    const totalSubmissions = points.reduce((sum, p) => sum + p.submissions, 0);
    const totalGuests = points.reduce((sum, p) => sum + p.guests, 0);
    const peakPoint = points.reduce(
      (best, p) => (p.submissions > best.submissions ? p : best),
      points[0]
    );

    return {
      points,
      totalSubmissions,
      totalGuests,
      avgPerDay: (totalSubmissions / 7).toFixed(1),
      peakDayLabel: peakPoint && peakPoint.submissions > 0 ? peakPoint.axisLabel : '—',
      peakCount: peakPoint ? peakPoint.submissions : 0,
    };
  }, [scopedAllResponses, searchQuery]);

  const companionStats = useMemo(
    () => countBy(filteredResponses, (r) => r.diningWith),
    [filteredResponses]
  );
  const transportStats = useMemo(
    () =>
      countBy(filteredResponses, (r) => r.transportMode).map((item) => ({
        ...item,
        sublabel: getTransportCategory(item.label as TransportModeOption),
      })),
    [filteredResponses]
  );
  const originStats = useMemo(
    () => countBy(filteredResponses, (r) => r.origin),
    [filteredResponses]
  );
  const destinationStats = useMemo(
    () => countBy(filteredResponses, (r) => r.destination),
    [filteredResponses]
  );
  const spendStats = useMemo(() => {
    const counts = countBy(filteredResponses, (r) => r.spendPerPax);
    const takeoutBySpend = new Map<string, number>();
    for (const r of filteredResponses) {
      if (r.orderedTakeout) {
        const key = r.spendPerPax || 'Unspecified';
        takeoutBySpend.set(key, (takeoutBySpend.get(key) ?? 0) + 1);
      }
    }
    return counts.map((item) => {
      const takeoutCount = takeoutBySpend.get(item.label) ?? 0;
      return {
        ...item,
        sublabel:
          takeoutCount > 0 ? `${takeoutCount} w/ takeout` : undefined,
      };
    });
  }, [filteredResponses]);
  const ageStats = useMemo(
    () => countBy(filteredResponses, (r) => r.ageGroup),
    [filteredResponses]
  );
  const genderStats = useMemo(
    () => countBy(filteredResponses, (r) => r.gender),
    [filteredResponses]
  );
  const occupationStats = useMemo(
    () => countBy(filteredResponses, (r) => r.occupation || 'Unspecified'),
    [filteredResponses]
  );
  const relationshipStats = useMemo(
    () => countBy(filteredResponses, (r) => r.relationshipStatus || 'Unspecified'),
    [filteredResponses]
  );
  const paymentStats = useMemo(
    () => countBy(filteredResponses, (r) => r.paymentMethod || 'Unspecified'),
    [filteredResponses]
  );
  const visitFrequencyStats = useMemo(
    () => countBy(filteredResponses, (r) => r.visitFrequency || 'Unspecified'),
    [filteredResponses]
  );

  const liveCsvPreview = useMemo(
    () => buildSurveyCsv(filteredResponses).replace(/^\uFEFF/, ''),
    [filteredResponses]
  );

  const dateFilterSlug =
    datePreset === 'today'
      ? todayStr
      : datePreset === '7days'
      ? 'last-7-days'
      : datePreset === 'custom'
      ? customDate
      : 'all-dates';

  const branchSlug = activeBranch
    ? activeBranch.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : 'head-office';

  const filterLabel = `${branchSlug}-${dateFilterSlug}`;

  const filterDisplayLabel =
    datePreset === 'today'
      ? `Today (${todayStr})`
      : datePreset === '7days'
      ? 'Last 7 Days'
      : datePreset === 'custom'
      ? customDate
      : 'All Dates';

  const scopeDisplayLabel = activeBranch
    ? `${activeBranch} Branch`
    : 'Head Office (All Branches)';

  const handlePrintSummary = () => {
    const previousTitle = document.title;
    const prefix =
      mode === 'dashboard'
        ? 'Jiang-Nan-Traffic-Summary'
        : 'Jiang-Nan-Response-Ledger';
    document.title = `${prefix}-${filterLabel}`;

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };

    window.addEventListener('afterprint', restoreTitle);
    window.print();
    window.setTimeout(restoreTitle, 1500);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteResponse(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const printedTimestamp = useMemo(
    () =>
      new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    []
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 print:max-w-none print:px-0 print:py-0 print:space-y-4">
      {/* Print-Only Formal Report Letterhead */}
      <div className="hidden print:flex items-center justify-between gap-4 pb-3.5 border-b-2 border-slate-900">
        <div className="flex items-center gap-3">
          <BrandLogo sizeClass="w-10 h-10" />
          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Jiang Nan — {scopeDisplayLabel}{' '}
              {mode === 'dashboard'
                ? 'Analytics Summary'
                : 'Response Ledger'}
            </div>
            <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
              <span>Date Scope: {filterDisplayLabel}</span>
              {searchQuery.trim() && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {metrics.count} {metrics.count === 1 ? 'response' : 'responses'} ({metrics.totalPax} pax)
              </span>
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
          <div>Generated {printedTimestamp}</div>
          <div>Latest entry: {metrics.latestDate}</div>
        </div>
      </div>

      {/* Workspace Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {isHeadOffice && activeBranch && (
              <>
                <button
                  type="button"
                  onClick={handleOpenWholeDashboard}
                  className="inline-flex items-center gap-1 font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Head Office</span>
                </button>
                <span aria-hidden="true">/</span>
              </>
            )}
            {lockedBranch && (
              <>
                <span className="font-medium text-red-600">
                  {lockedBranch} Branch View
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
              <span>Today: {todayReadable}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Latest entry: {metrics.latestDate}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 text-balance">
            {activeBranch
              ? mode === 'dashboard'
                ? `${activeBranch} — Branch Dashboard`
                : `${activeBranch} — Response Ledger`
              : mode === 'dashboard'
              ? 'Head Office — Whole Dashboard'
              : 'Head Office — Response Ledger'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenSurveyCodes && (
            <button
              type="button"
              onClick={onOpenSurveyCodes}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg border border-red-200 bg-red-50/80 hover:bg-red-100/80 text-xs sm:text-sm font-semibold text-red-700 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <KeyRound className="w-4 h-4 text-red-600" aria-hidden="true" />
              <span>Survey Codes</span>
              <span className="font-mono text-xs text-red-600 tabular-nums">
                ({activeCodeCount})
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrintSummary}
            disabled={isLoading || filteredResponses.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium text-slate-700 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Printer className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Print Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCsvPreview((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-medium text-slate-700 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>{showCsvPreview ? 'Hide CSV Preview' : 'Preview Live CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => onDownloadCsv(filteredResponses, filterLabel)}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>
              {isDownloading
                ? 'Preparing CSV...'
                : `Download CSV (${filteredResponses.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onStartSurvey(activeBranch)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>{activeBranch ? `Open ${activeBranch} Survey` : 'Open Survey'}</span>
          </button>
        </div>
      </div>

      {/* Head Office Scope Switcher: Whole Network vs. Per Branch (Hidden for Branch Accounts) */}
      {isHeadOffice && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="tablist"
                aria-label="Dashboard scope"
                className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveScope === 'all'}
                  onClick={handleOpenWholeDashboard}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap min-h-[36px] ${
                    effectiveScope === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Head Office (Whole)</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveScope === 'branch'}
                  onClick={() => {
                    setScope('branch');
                    setConfirmClear(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap min-h-[36px] ${
                    effectiveScope === 'branch'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Per Branch</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-2">
                <span>{BRANCH_OPTIONS.length} branches</span>
                <span aria-hidden="true">·</span>
                <span>{activeBranchesAllTimeCount} with responses</span>
              </div>
            </div>

            {/* Quick Jump Branch Selector */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="branch-quick-select"
                className="text-xs font-medium text-slate-500 whitespace-nowrap"
              >
                Branch view:
              </label>
              <select
                id="branch-quick-select"
                value={effectiveScope === 'all' ? '__ALL__' : selectedBranch}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__ALL__') {
                    handleOpenWholeDashboard();
                  } else {
                    handleOpenBranchDashboard(val as BranchOption);
                  }
                }}
                className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[220px]"
              >
                <option value="__ALL__">
                  Head Office — All Branches ({responses.length})
                </option>
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch} ({branchTotalCounts.get(branch) ?? 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-Branch Interactive 21-Branch Switcher */}
          {effectiveScope === 'branch' && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-700">
                  Select a Jiang Nan branch to view its dedicated dashboard
                </div>
                <div className="relative w-full sm:w-64">
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={branchPickerQuery}
                    onChange={(e) => setBranchPickerQuery(e.target.value)}
                    placeholder="Find branch..."
                    className="w-full h-9 pl-8 pr-7 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {branchPickerQuery && (
                    <button
                      type="button"
                      onClick={() => setBranchPickerQuery('')}
                      aria-label="Clear branch filter"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {filteredSwitcherBranches.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No branch matches &ldquo;{branchPickerQuery}&rdquo;.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {filteredSwitcherBranches.map((branch) => {
                    const isActive = selectedBranch === branch;
                    const count = branchTotalCounts.get(branch) ?? 0;
                    return (
                      <button
                        key={branch}
                        type="button"
                        onClick={() => handleOpenBranchDashboard(branch)}
                        className={`px-3 py-2 min-h-[40px] rounded-lg border text-left flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                          isActive
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <span className="text-xs font-semibold truncate">{branch}</span>
                        <span
                          className={`text-[11px] font-mono tabular-nums shrink-0 ${
                            isActive
                              ? 'text-red-100'
                              : count > 0
                              ? 'text-red-600 font-semibold'
                              : 'text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Customer-Only Survey Link Strip (Dynamic per active branch or general) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900">
              {activeBranch
                ? `${activeBranch} Branch Survey Link (Auto-selects ${activeBranch})`
                : 'Customer Survey Link (All Branches · Dashboard hidden)'}
            </div>
            <div className="text-xs font-mono text-slate-500 truncate mt-0.5">
              {getCustomerSurveyUrl(activeBranch)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onCopySurveyLink(activeBranch)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 transition-colors whitespace-nowrap"
          >
            {copiedSurveyLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span className="text-red-600">Copied Link</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>{activeBranch ? 'Copy Branch Link' : 'Copy Survey Link'}</span>
              </>
            )}
          </button>
          <a
            href={
              activeBranch
                ? `#/survey?branch=${encodeURIComponent(activeBranch)}`
                : '#/survey'
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <span>Open Survey</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Filter Bar: Date Range & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All Dates' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: 'custom', label: 'Pick Date' },
              ] as { id: DatePreset; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDatePreset(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[34px] ${
                  datePreset === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              aria-label="Filter by specific date"
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branch, name, mode, origin..."
            className="w-full h-10 pl-9 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Optional Live CSV Preview Drawer */}
      {showCsvPreview && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 print:hidden">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Auto-Updated CSV Feed Preview ({scopeDisplayLabel})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Updates automatically on every new submission. Press Download CSV to export.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDownloadCsv(filteredResponses, filterLabel)}
              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium whitespace-nowrap"
            >
              Export Now
            </button>
          </div>
          <pre className="mt-3 p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-60">
            {liveCsvPreview}
          </pre>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm text-amber-900"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-5 h-28 animate-pulse"
              >
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-7 w-16 bg-slate-200 rounded mt-4" />
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl h-64 animate-pulse" />
        </div>
      ) : scopedAllResponses.length === 0 ? (
        /* Empty State (Whole or Per-Branch) */
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            {activeBranch ? (
              <Building2 className="w-6 h-6" aria-hidden="true" />
            ) : (
              <ClipboardList className="w-6 h-6" aria-hidden="true" />
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-4">
            {activeBranch
              ? `No survey responses recorded for ${activeBranch} yet`
              : 'No survey responses recorded yet'}
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
            {activeBranch
              ? `Share the ${activeBranch} branch survey link or log a response below to populate this branch's dedicated analytics.`
              : 'Start taking visitor surveys across Jiang Nan branches to populate real-time traffic, dining group, journey, and budget insights.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onStartSurvey(activeBranch)}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>
                {activeBranch ? `Start ${activeBranch} Survey` : 'Start First Survey'}
              </span>
            </button>
            {activeBranch && (
              <>
                <button
                  type="button"
                  onClick={() => onCopySurveyLink(activeBranch)}
                  className="inline-flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <Copy className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>Copy Branch Link</span>
                </button>
                {isHeadOffice && (
                  <button
                    type="button"
                    onClick={handleOpenWholeDashboard}
                    className="inline-flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Head Office</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4 print:gap-2.5 print-avoid-break">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">
                  {activeBranch ? `${activeBranch} Responses` : 'Total Responses'}
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums">
                  {metrics.count}
                </div>
                <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                  {metrics.totalPax} guests
                  {!activeBranch && ` · ${branchOverview.activeCount}/${BRANCH_OPTIONS.length} branches`}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Avg Party Size</div>
                <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums">
                  {metrics.avgPax}
                </div>
                <div className="mt-1 text-xs text-slate-500">pax per table</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Top Arrival Mode</div>
                <div className="mt-2 text-base sm:text-lg font-bold text-slate-900 truncate">
                  {metrics.topTransport}
                </div>
                <div className="mt-1 text-xs text-slate-500">most frequent</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                {metrics.topTransport !== '—' ? (
                  <TransportIcon
                    mode={metrics.topTransport as SurveyResponse['transportMode']}
                    className="w-5 h-5"
                  />
                ) : (
                  <Car className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Top Spend / Pax</div>
                <div className="mt-2 text-base sm:text-lg font-bold font-mono text-red-600 truncate tabular-nums">
                  {metrics.topSpend}
                </div>
                <div className="mt-1 text-xs text-slate-500">willingness to spend</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Whole Network: Branch Performance Overview (Head Office Only) */}
          {isHeadOffice && effectiveScope === 'all' && mode === 'dashboard' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden print-avoid-break print:rounded-xl print:border-slate-300">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:px-4 print:py-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Branch Performance Overview
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                      <span>{BRANCH_OPTIONS.length} Jiang Nan branches</span>
                      <span aria-hidden="true">·</span>
                      <span>{branchOverview.activeCount} active in scope</span>
                      <span aria-hidden="true">·</span>
                      <span>Click any branch to open its dashboard</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setShowActiveBranchesOnly(false)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[30px] ${
                        !showActiveBranchesOnly
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All 21 Branches
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowActiveBranchesOnly(true)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[30px] ${
                        showActiveBranchesOnly
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active Only ({branchOverview.activeCount})
                    </button>
                  </div>

                  <div className="relative w-44">
                    <Search
                      className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={branchPickerQuery}
                      onChange={(e) => setBranchPickerQuery(e.target.value)}
                      placeholder="Filter branch..."
                      className="w-full h-9 pl-8 pr-7 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    {branchPickerQuery && (
                      <button
                        type="button"
                        onClick={() => setBranchPickerQuery('')}
                        aria-label="Clear branch filter"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4 whitespace-nowrap">Branch</th>
                      <th className="py-2.5 px-4 whitespace-nowrap text-right">
                        Responses
                      </th>
                      <th className="py-2.5 px-4 whitespace-nowrap w-40 hidden sm:table-cell">
                        Network Share
                      </th>
                      <th className="py-2.5 px-4 whitespace-nowrap text-right">
                        Guests (Pax)
                      </th>
                      <th className="py-2.5 px-4 whitespace-nowrap text-right hidden md:table-cell">
                        Avg Pax
                      </th>
                      <th className="py-2.5 px-4 whitespace-nowrap hidden lg:table-cell">
                        Top Spend Package
                      </th>
                      <th className="py-2.5 px-4 whitespace-nowrap text-right print:hidden">
                        Dashboard
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOverviewRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 px-4 text-center text-xs text-slate-500"
                        >
                          No branches match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredOverviewRows.map((row) => (
                        <tr
                          key={row.branch}
                          onClick={() => handleOpenBranchDashboard(row.branch)}
                          className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap font-semibold text-slate-900">
                            {row.branch}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono tabular-nums">
                            <span
                              className={
                                row.count > 0
                                  ? 'font-semibold text-slate-900'
                                  : 'text-slate-400'
                              }
                            >
                              {row.count}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap hidden sm:table-cell">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-red-500 rounded-full transition-all duration-300"
                                  style={{ width: `${row.sharePct}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-slate-500 tabular-nums w-9 text-right">
                                {row.sharePct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono text-slate-700 tabular-nums">
                            {row.totalPax}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono text-slate-600 tabular-nums hidden md:table-cell">
                            {row.count > 0 ? row.avgPax : '—'}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap text-slate-600 font-mono text-xs hidden lg:table-cell truncate max-w-[240px]">
                            {row.topSpend}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap text-right print:hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBranchDashboard(row.branch);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 group-hover:text-red-700 whitespace-nowrap"
                            >
                              <span>View</span>
                              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}

                    {branchOverview.unassignedCount > 0 && !branchPickerQuery.trim() && (
                      <tr className="bg-slate-50/70 text-slate-500">
                        <td className="py-2.5 px-4 whitespace-nowrap font-medium">
                          Unassigned (Prior to Branch Tracking)
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono tabular-nums">
                          {branchOverview.unassignedCount}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap hidden sm:table-cell font-mono text-xs text-slate-400">
                          {branchOverview.totalCount > 0
                            ? `${Math.round(
                                (branchOverview.unassignedCount /
                                  branchOverview.totalCount) *
                                  100
                              )}%`
                            : '0%'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono tabular-nums">
                          {branchOverview.unassignedPax}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono tabular-nums hidden md:table-cell">
                          {(
                            branchOverview.unassignedPax /
                            branchOverview.unassignedCount
                          ).toFixed(1)}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-xs hidden lg:table-cell">
                          Included in Whole totals
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-right text-xs text-slate-400 print:hidden">
                          —
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summarized Icon Highlights & Detailed Breakdowns */}
          {mode === 'dashboard' && (
            <>
              {/* 7-Day Submission Trends Line Chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 print-avoid-break print:rounded-xl print:p-4 print:border-slate-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 print:pb-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        Survey Submission Trends
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        <span>Last 7 days</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {last7DaysTrend.totalSubmissions}{' '}
                          {last7DaysTrend.totalSubmissions === 1 ? 'submission' : 'submissions'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{last7DaysTrend.avgPerDay}/day avg</span>
                        {last7DaysTrend.peakCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              Peak: {last7DaysTrend.peakDayLabel} ({last7DaysTrend.peakCount})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start sm:self-auto shrink-0 print:hidden">
                    <button
                      type="button"
                      onClick={() => setTrendMetric('submissions')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[32px] ${
                        trendMetric === 'submissions'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Submissions
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendMetric('guests')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[32px] ${
                        trendMetric === 'guests'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Guests (Pax)
                    </button>
                  </div>
                </div>

                <div className="mt-5 h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={last7DaysTrend.points}
                      margin={{ top: 10, right: 16, left: -8, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="axisLabel"
                        axisLine={false}
                        tickLine={false}
                        dy={8}
                        tick={{
                          fill: '#64748b',
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        tick={{
                          fill: '#64748b',
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      />
                      <Tooltip
                        content={<TrendTooltip />}
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                      />
                      <Line
                        type="monotone"
                        dataKey={trendMetric}
                        name={trendMetric === 'submissions' ? 'Submissions' : 'Total Guests'}
                        stroke={trendMetric === 'submissions' ? '#ef4444' : '#0f172a'}
                        strokeWidth={2.5}
                        dot={{
                          r: 4,
                          fill: '#ffffff',
                          stroke: trendMetric === 'submissions' ? '#ef4444' : '#0f172a',
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 6,
                          fill: trendMetric === 'submissions' ? '#ef4444' : '#0f172a',
                          stroke: '#ffffff',
                          strokeWidth: 2,
                        }}
                        animationDuration={300}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="hidden print:grid print:grid-cols-7 gap-2 mt-3 pt-3 border-t border-slate-200 text-center font-mono tabular-nums">
                  {last7DaysTrend.points.map((point) => (
                    <div key={point.dateStr} className="text-[10px]">
                      <div className="text-slate-500">{point.axisLabel}</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {point.submissions} resp
                      </div>
                      <div className="text-slate-500">{point.guests} pax</div>
                    </div>
                  ))}
                </div>

                {last7DaysTrend.totalSubmissions === 0 && (
                  <p className="text-xs text-slate-400 text-center mt-2">
                    No survey submissions recorded within the last 7 days.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2.5 print-avoid-break">
                {[
                  {
                    label: 'Top Dining Group',
                    item: companionStats[0],
                    icon: companionStats[0] ? (
                      <CompanionIcon
                        companion={
                          companionStats[0].label as SurveyResponse['diningWith']
                        }
                        className="w-5 h-5"
                      />
                    ) : (
                      <Users className="w-5 h-5" aria-hidden="true" />
                    ),
                  },
                  {
                    label: 'Top Previous Stop',
                    item: originStats[0],
                    icon: originStats[0] ? (
                      <LocationIcon location={originStats[0].label} className="w-5 h-5" />
                    ) : (
                      <MapPin className="w-5 h-5" aria-hidden="true" />
                    ),
                  },
                  {
                    label: 'Top Next Stop',
                    item: destinationStats[0],
                    icon: destinationStats[0] ? (
                      <LocationIcon
                        location={destinationStats[0].label}
                        className="w-5 h-5"
                      />
                    ) : (
                      <Compass className="w-5 h-5" aria-hidden="true" />
                    ),
                  },
                  {
                    label: 'Top Payment Mode',
                    item: paymentStats[0],
                    icon: paymentStats[0] ? (
                      <PaymentMethodIcon
                        method={paymentStats[0].label}
                        className="w-5 h-5"
                      />
                    ) : (
                      <CreditCard className="w-5 h-5" aria-hidden="true" />
                    ),
                  },
                  {
                    label: 'Top Occupation',
                    item: occupationStats[0],
                    icon:
                      occupationStats[0] &&
                      occupationStats[0].label !== 'Unspecified' ? (
                        <OccupationIcon
                          occupation={occupationStats[0].label as OccupationOption}
                          className="w-5 h-5"
                        />
                      ) : (
                        <Briefcase className="w-5 h-5" aria-hidden="true" />
                      ),
                  },
                  {
                    label: 'Top Relationship',
                    item: relationshipStats[0],
                    icon:
                      relationshipStats[0] &&
                      relationshipStats[0].label !== 'Unspecified' ? (
                        <RelationshipIcon
                          status={
                            relationshipStats[0].label as RelationshipStatusOption
                          }
                          className="w-5 h-5"
                        />
                      ) : (
                        <Heart className="w-5 h-5" aria-hidden="true" />
                      ),
                  },
                  {
                    label: 'Top Age Range',
                    item: ageStats[0],
                    icon: ageStats[0] ? (
                      <AgeGroupIcon
                        ageGroup={ageStats[0].label as AgeGroupOption}
                        className="w-5 h-5"
                      />
                    ) : (
                      <User className="w-5 h-5" aria-hidden="true" />
                    ),
                  },
                  {
                    label: 'Top Gender',
                    item: genderStats[0],
                    icon: genderStats[0] ? (
                      <GenderIcon
                        gender={genderStats[0].label as GenderOption}
                        className="w-5 h-5"
                      />
                    ) : (
                      <User className="w-5 h-5" aria-hidden="true" />
                    ),
                  },
                ].map((tile) => {
                  const pct =
                    tile.item && filteredResponses.length > 0
                      ? Math.round((tile.item.count / filteredResponses.length) * 100)
                      : 0;
                  return (
                    <div
                      key={tile.label}
                      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 min-w-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                        {tile.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-slate-500 truncate">
                          {tile.label}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate mt-0.5">
                          {tile.item ? tile.item.label : '—'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {tile.item ? `${tile.item.count} (${pct}%)` : 'No data'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 print:grid-cols-2 print:gap-3">
                <BreakdownBarList
                  title="How Visitors Arrived"
                  headerIcon={<Car className="w-4 h-4" aria-hidden="true" />}
                  items={transportStats}
                  total={filteredResponses.length}
                  renderIcon={(label) => (
                    <TransportIcon
                      mode={label as SurveyResponse['transportMode']}
                      className="w-4 h-4"
                    />
                  )}
                />

                <BreakdownBarList
                  title="Dining Companion Type"
                  headerIcon={<Users className="w-4 h-4" aria-hidden="true" />}
                  items={companionStats}
                  total={filteredResponses.length}
                  renderIcon={(label) => (
                    <CompanionIcon
                      companion={label as SurveyResponse['diningWith']}
                      className="w-4 h-4"
                    />
                  )}
                />

                <BreakdownBarList
                  title="Before Dining With Us"
                  headerIcon={<MapPin className="w-4 h-4" aria-hidden="true" />}
                  items={originStats}
                  total={filteredResponses.length}
                  renderIcon={(label) => (
                    <LocationIcon location={label} className="w-4 h-4" />
                  )}
                />

                <BreakdownBarList
                  title="After Dining With Us"
                  headerIcon={<Compass className="w-4 h-4" aria-hidden="true" />}
                  items={destinationStats}
                  total={filteredResponses.length}
                  renderIcon={(label) => (
                    <LocationIcon location={label} className="w-4 h-4" />
                  )}
                />

                <BreakdownBarList
                  title="Willingness to Spend per Pax"
                  headerIcon={<Wallet className="w-4 h-4" aria-hidden="true" />}
                  items={spendStats}
                  total={filteredResponses.length}
                  renderIcon={() => <Banknote className="w-4 h-4" aria-hidden="true" />}
                />

                <BreakdownBarList
                  title="Preferred Mode of Payment"
                  headerIcon={<CreditCard className="w-4 h-4" aria-hidden="true" />}
                  items={paymentStats}
                  total={filteredResponses.length}
                  renderIcon={(label) => (
                    <PaymentMethodIcon method={label} className="w-4 h-4" />
                  )}
                />

                <BreakdownBarList
                  title="Occupation"
                  headerIcon={<Briefcase className="w-4 h-4" aria-hidden="true" />}
                  items={occupationStats}
                  total={filteredResponses.length}
                  renderIcon={(label) =>
                    label !== 'Unspecified' ? (
                      <OccupationIcon
                        occupation={label as OccupationOption}
                        className="w-4 h-4"
                      />
                    ) : (
                      <Briefcase className="w-4 h-4" aria-hidden="true" />
                    )
                  }
                />

                <BreakdownBarList
                  title="Relationship Status"
                  headerIcon={<Heart className="w-4 h-4" aria-hidden="true" />}
                  items={relationshipStats}
                  total={filteredResponses.length}
                  renderIcon={(label) =>
                    label !== 'Unspecified' ? (
                      <RelationshipIcon
                        status={label as RelationshipStatusOption}
                        className="w-4 h-4"
                      />
                    ) : (
                      <Heart className="w-4 h-4" aria-hidden="true" />
                    )
                  }
                />

                <BreakdownBarList
                  title="Age"
                  headerIcon={<User className="w-4 h-4" aria-hidden="true" />}
                  items={ageStats}
                  total={filteredResponses.length}
                  renderIcon={(label) => (
                    <AgeGroupIcon
                      ageGroup={label as AgeGroupOption}
                      className="w-4 h-4"
                    />
                  )}
                />

                <BreakdownBarList
                  title="Gender"
                  headerIcon={<Users className="w-4 h-4" aria-hidden="true" />}
                  items={genderStats}
                  total={filteredResponses.length}
                  renderIcon={(label) => (
                    <GenderIcon gender={label as GenderOption} className="w-4 h-4" />
                  )}
                />

                <BreakdownBarList
                  title="Visit Frequency"
                  headerIcon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
                  items={visitFrequencyStats}
                  total={filteredResponses.length}
                  renderIcon={(label) =>
                    label !== 'Unspecified' ? (
                      <VisitFrequencyIcon
                        frequency={label as VisitFrequencyOption}
                        className="w-4 h-4"
                      />
                    ) : (
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    )
                  }
                />
              </div>
            </>
          )}

          {/* Response Ledger (Desktop Table + Mobile Cards) */}
          <div
            className={`bg-white border border-slate-200 rounded-2xl overflow-hidden print:rounded-xl print:border-slate-300 ${
              mode === 'dashboard' ? 'print-break-before' : ''
            }`}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:px-4 print:py-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {activeBranch
                    ? `${activeBranch} — Recorded Submissions`
                    : 'Recorded Submissions (All Branches)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  Showing {filteredResponses.length} of {scopedAllResponses.length} saved responses
                </p>
              </div>

              {isHeadOffice && scopedAllResponses.length > 0 && (
                <div className="flex items-center gap-2 print:hidden">
                  {confirmClear ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-700 font-medium">
                        {activeBranch
                          ? `Clear all ${activeBranch} records?`
                          : 'Clear all records?'}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (activeBranch) {
                            await onClearBranch(activeBranch);
                          } else {
                            await onClearAll();
                          }
                          setConfirmClear(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      {activeBranch ? `Clear ${activeBranch}` : 'Reset Data'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredResponses.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No responses match your current date filter or search query.
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block print:block overflow-x-auto print:overflow-visible">
                  <table className="print-ledger-table w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4 whitespace-nowrap">Date & Time</th>
                        {!activeBranch && (
                          <th className="py-3 px-4 whitespace-nowrap">Branch</th>
                        )}
                        <th className="py-3 px-4 whitespace-nowrap">Respondent</th>
                        <th className="py-3 px-4 whitespace-nowrap">Demographics</th>
                        <th className="py-3 px-4 whitespace-nowrap">Occupation & Status</th>
                        <th className="py-3 px-4 whitespace-nowrap">Dining Group</th>
                        <th className="py-3 px-4 whitespace-nowrap">Visit</th>
                        <th className="py-3 px-4 whitespace-nowrap">Arrival Mode</th>
                        <th className="py-3 px-4 whitespace-nowrap">Journey</th>
                        <th className="py-3 px-4 whitespace-nowrap">Payment</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">
                          Budget / Pax
                        </th>
                        {isHeadOffice && (
                          <th className="py-3 px-3 text-right whitespace-nowrap print:hidden">
                            <span className="sr-only">Actions</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredResponses.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-700 tabular-nums">
                            <div className="font-medium text-slate-900">
                              {r.submittedDate}
                            </div>
                            <div className="text-slate-400">
                              {formatTime(r.submittedAt)}
                            </div>
                          </td>
                          {!activeBranch && (
                            <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold text-slate-800">
                              {r.branch ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenBranchDashboard(r.branch!)}
                                  className="hover:text-red-600 transition-colors text-left"
                                >
                                  {r.branch}
                                </button>
                              ) : (
                                <span className="text-slate-400 font-normal">
                                  Unassigned
                                </span>
                              )}
                            </td>
                          )}
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900">
                            {r.name || (
                              <span className="text-slate-400 font-normal">Anonymous</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            <span>{r.gender}</span>
                            <span className="mx-1.5 text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono text-xs tabular-nums">
                              {r.ageGroup}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            <span>{r.occupation || 'Unspecified'}</span>
                            <span className="mx-1.5 text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span>{r.relationshipStatus || 'Unspecified'}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 tabular-nums">
                            <span>{r.diningWith}</span>
                            <span className="mx-1.5 text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono text-xs text-slate-500">
                              {r.partySize} pax
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                            {r.visitFrequency ? (
                              <span>{r.visitFrequency}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-2 text-slate-800">
                              <TransportIcon
                                mode={r.transportMode}
                                className="w-4 h-4 text-slate-500 shrink-0"
                              />
                              <span>{r.transportMode}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{r.origin}</span>
                              <ArrowRight
                                className="w-3.5 h-3.5 text-slate-400 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{r.destination}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                            <div className="inline-flex items-center gap-1.5">
                              <PaymentMethodIcon
                                method={r.paymentMethod || 'Unspecified'}
                                className="w-3.5 h-3.5 text-slate-500 shrink-0"
                              />
                              <span>{r.paymentMethod || 'Unspecified'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-semibold text-red-600 tabular-nums">
                            <div>{r.spendPerPax}</div>
                            {r.orderedTakeout && (
                              <div className="text-[11px] font-normal text-slate-500">
                                + Takeout
                              </div>
                            )}
                          </td>
                          {isHeadOffice && (
                            <td className="py-3 px-3 text-right whitespace-nowrap print:hidden">
                              <button
                                type="button"
                                aria-label={`Delete response ${r.id}`}
                                disabled={deletingId === r.id}
                                onClick={() => void handleDelete(r.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden print:hidden divide-y divide-slate-100">
                  {filteredResponses.map((r) => (
                    <div key={r.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {r.name || 'Anonymous'}
                          </div>
                          <div className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                            {r.submittedDate} · {formatTime(r.submittedAt)}
                            {!activeBranch && ` · ${r.branch || 'Unassigned'}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-xs font-mono font-semibold text-red-600 tabular-nums">
                              {r.spendPerPax}
                            </div>
                            {r.orderedTakeout && (
                              <div className="text-[11px] font-mono text-slate-500">
                                + Takeout
                              </div>
                            )}
                          </div>
                          {isHeadOffice && (
                            <button
                              type="button"
                              aria-label={`Delete response ${r.id}`}
                              disabled={deletingId === r.id}
                              onClick={() => void handleDelete(r.id)}
                              className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-400">Profile: </span>
                          {r.gender} · {r.ageGroup}
                        </div>
                        <div className="tabular-nums">
                          <span className="text-slate-400">Group: </span>
                          {r.diningWith} ({r.partySize} pax)
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">Status: </span>
                          {r.occupation || 'Unspecified'} · {r.relationshipStatus || 'Unspecified'}
                        </div>
                        {r.visitFrequency && (
                          <div className="col-span-2">
                            <span className="text-slate-400">Visit History: </span>
                            <span className="font-medium text-slate-700">
                              {r.visitFrequency}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2 flex items-center gap-1.5 text-slate-700">
                          <TransportIcon
                            mode={r.transportMode}
                            className="w-3.5 h-3.5 text-slate-500 shrink-0"
                          />
                          <span>{r.transportMode}</span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5 text-slate-700">
                          <MapPin
                            className="w-3.5 h-3.5 text-slate-400 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{r.origin}</span>
                          <ArrowRight
                            className="w-3 h-3 text-slate-400 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{r.destination}</span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5 text-slate-700">
                          <PaymentMethodIcon
                            method={r.paymentMethod || 'Unspecified'}
                            className="w-3.5 h-3.5 text-slate-500 shrink-0"
                          />
                          <span>{r.paymentMethod || 'Unspecified'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Print-Only Footer */}
          <footer className="hidden print:flex items-center justify-between pt-3 border-t border-slate-200 text-[10px] text-slate-500 font-mono tabular-nums">
            <span>Jiang Nan · {scopeDisplayLabel} Traffic Generation Survey Report</span>
            <span>Generated {printedTimestamp}</span>
          </footer>
        </>
      )}
    </div>
  );
}
