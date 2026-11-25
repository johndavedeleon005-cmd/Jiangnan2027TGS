import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Link2,
  Lock,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  BRANCH_OPTIONS,
  normalizeSurveyCode,
  type BranchCodeLimitRecord,
  type BranchOption,
  type SurveyCodeRecord,
  type SurveyCodeStatus,
  type SurveyResponse,
} from '../types/survey';
import {
  activateBranchSurveyCodes,
  activateSurveyCode,
  activateSurveyCodeBatch,
  applyLimitToAllBranches,
  deleteRevokedSurveyCode,
  getCustomerSurveyUrlWithCode,
  resetBranchCodeUsage,
  revokeSurveyCode,
  setBranchCodeLimit,
} from '../utils/surveyCodeStorage';

interface SurveyCodesViewProps {
  codes: SurveyCodeRecord[];
  responses: SurveyResponse[];
  isLoading: boolean;
  error: string | null;
  lockedBranch: BranchOption | null;
  branchLimits: Record<string, BranchCodeLimitRecord>;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}

export function SurveyCodesView({
  codes,
  responses,
  isLoading,
  error,
  lockedBranch,
  branchLimits,
}: SurveyCodesViewProps) {
  const isHeadOffice = !lockedBranch;

  const [selectedBranch, setSelectedBranch] = useState<BranchOption | ''>(
    () => lockedBranch || ''
  );
  const [customCode, setCustomCode] = useState('');
  const [note, setNote] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recentCodes, setRecentCodes] = useState<SurveyCodeRecord[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | SurveyCodeStatus>('all');
  const [redeemedBranchFilter, setRedeemedBranchFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  // Head Office Branch Limit Manager state
  const [showLimitsPanel, setShowLimitsPanel] = useState<boolean>(true);
  const [limitSearch, setLimitSearch] = useState('');
  const [bulkLimitValue, setBulkLimitValue] = useState<string>('20');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [savingBranchLimit, setSavingBranchLimit] = useState<string | null>(null);
  const [savedBranchLimit, setSavedBranchLimit] = useState<string | null>(null);

  useEffect(() => {
    if (lockedBranch) {
      setSelectedBranch(lockedBranch);
    }
  }, [lockedBranch]);

  // Sync draft limit inputs from Firestore when limits change (unless user is mid-edit)
  useEffect(() => {
    setLimitInputs((prev) => {
      const next = { ...prev };
      for (const branch of BRANCH_OPTIONS) {
        const rec = branchLimits[branch];
        const serverVal = String(rec ? rec.maxCodes : 0);
        if (next[branch] === undefined) {
          next[branch] = serverVal;
        }
      }
      return next;
    });
  }, [branchLimits]);

  // Branch quota calculation (for branch logins)
  const branchQuota = useMemo(() => {
    if (!lockedBranch) return null;
    const rec = branchLimits[lockedBranch];
    const maxCodes = rec ? Math.max(0, rec.maxCodes) : 0;
    const generatedCount = rec ? Math.max(0, rec.generatedCount) : 0;
    const remaining = Math.max(0, maxCodes - generatedCount);
    const percentUsed =
      maxCodes > 0 ? Math.min(100, Math.round((generatedCount / maxCodes) * 100)) : 0;
    return { maxCodes, generatedCount, remaining, percentUsed };
  }, [lockedBranch, branchLimits]);

  // Head Office summary of configured branches
  const configuredBranchesSummary = useMemo(() => {
    let enabledCount = 0;
    let totalQuota = 0;
    let totalGenerated = 0;
    for (const branch of BRANCH_OPTIONS) {
      const rec = branchLimits[branch];
      if (rec) {
        if (rec.maxCodes > 0) enabledCount += 1;
        totalQuota += Math.max(0, rec.maxCodes);
        totalGenerated += Math.max(0, rec.generatedCount);
      }
    }
    return { enabledCount, totalQuota, totalGenerated };
  }, [branchLimits]);

  const filteredLimitBranches = useMemo(() => {
    const q = limitSearch.trim().toUpperCase();
    if (!q) return BRANCH_OPTIONS;
    return BRANCH_OPTIONS.filter((b) => b.includes(q));
  }, [limitSearch]);

  const stats = useMemo(() => {
    let active = 0;
    let used = 0;
    let revoked = 0;
    for (const c of codes) {
      if (c.status === 'active') active += 1;
      else if (c.status === 'used') used += 1;
      else revoked += 1;
    }
    return { active, used, revoked, total: codes.length };
  }, [codes]);

  // Lookup map linking each code to its redeemed branch & respondent (supports both new `usedAtBranch` and legacy redeemed codes)
  const redemptionDetailsByCode = useMemo(() => {
    const responseById = new Map<string, SurveyResponse>();
    const responseByCode = new Map<string, SurveyResponse>();
    for (const r of responses) {
      responseById.set(r.id, r);
      if (r.surveyCode) {
        responseByCode.set(r.surveyCode, r);
      }
    }

    const details = new Map<
      string,
      { branch: BranchOption | ''; respondentName: string; isCrossBranch: boolean }
    >();

    for (const c of codes) {
      if (c.status !== 'used') continue;
      const linked =
        (c.usedByResponseId ? responseById.get(c.usedByResponseId) : undefined) ||
        responseByCode.get(c.code);
      const redeemedBranch = (c.usedAtBranch || linked?.branch || '') as
        | BranchOption
        | '';
      const isCrossBranch = Boolean(
        c.branch && redeemedBranch && c.branch !== redeemedBranch
      );
      details.set(c.code, {
        branch: redeemedBranch,
        respondentName: linked?.name ? linked.name : '',
        isCrossBranch,
      });
    }

    return details;
  }, [codes, responses]);

  // Head Office breakdown of where codes were redeemed
  const redemptionsByBranch = useMemo(() => {
    const counts = new Map<string, number>();
    let totalRedeemedWithBranch = 0;
    let crossBranchCount = 0;

    for (const c of codes) {
      if (c.status !== 'used') continue;
      const info = redemptionDetailsByCode.get(c.code);
      const branchLabel = info?.branch || 'Unspecified';
      counts.set(branchLabel, (counts.get(branchLabel) ?? 0) + 1);
      if (info?.branch) totalRedeemedWithBranch += 1;
      if (info?.isCrossBranch) crossBranchCount += 1;
    }

    const rows = Array.from(counts.entries())
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count || a.branch.localeCompare(b.branch));

    return { rows, totalRedeemedWithBranch, crossBranchCount };
  }, [codes, redemptionDetailsByCode]);

  const filteredCodes = useMemo(() => {
    let list = codes;
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (isHeadOffice && redeemedBranchFilter !== 'all') {
      list = list.filter((c) => {
        if (c.status !== 'used') return false;
        const info = redemptionDetailsByCode.get(c.code);
        const branchLabel = info?.branch || 'Unspecified';
        return branchLabel === redeemedBranchFilter;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => {
        const info = redemptionDetailsByCode.get(c.code);
        return (
          c.code.toLowerCase().includes(q) ||
          (c.branch || 'any branch').toLowerCase().includes(q) ||
          (info?.branch || '').toLowerCase().includes(q) ||
          (info?.respondentName || '').toLowerCase().includes(q) ||
          (c.createdBy || '').toLowerCase().includes(q) ||
          (c.note || '').toLowerCase().includes(q) ||
          (c.usedByResponseId || '').toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [
    codes,
    statusFilter,
    isHeadOffice,
    redeemedBranchFilter,
    searchQuery,
    redemptionDetailsByCode,
  ]);

  const activeCodes = useMemo(
    () => codes.filter((c) => c.status === 'active'),
    [codes]
  );

  const handleActivateSingle = async (useCustom: boolean) => {
    setIsActivating(true);
    setActionError(null);
    try {
      if (lockedBranch) {
        const created = await activateBranchSurveyCodes(lockedBranch, {
          count: 1,
          customCode: useCustom ? customCode : undefined,
          note,
        });
        setRecentCodes(created);
        if (useCustom) setCustomCode('');
      } else {
        const created = await activateSurveyCode({
          customCode: useCustom ? customCode : undefined,
          branch: selectedBranch,
          note,
        });
        setRecentCodes([created]);
        if (useCustom) setCustomCode('');
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to activate survey code.'
      );
    } finally {
      setIsActivating(false);
    }
  };

  const handleActivateBatch = async (count: number) => {
    setIsActivating(true);
    setActionError(null);
    try {
      if (lockedBranch) {
        const created = await activateBranchSurveyCodes(lockedBranch, {
          count,
          note,
        });
        setRecentCodes(created);
      } else {
        const created = await activateSurveyCodeBatch(count, {
          branch: selectedBranch,
          note,
        });
        setRecentCodes(created);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to activate batch of codes.'
      );
    } finally {
      setIsActivating(false);
    }
  };

  const handleSaveBranchLimit = async (branch: BranchOption) => {
    if (!isHeadOffice) return;
    const rawVal = limitInputs[branch] ?? String(branchLimits[branch]?.maxCodes ?? 0);
    const parsed = Math.max(0, Math.min(10000, Math.floor(Number(rawVal) || 0)));
    setSavingBranchLimit(branch);
    setActionError(null);
    try {
      await setBranchCodeLimit(branch, parsed);
      setLimitInputs((prev) => ({ ...prev, [branch]: String(parsed) }));
      setSavedBranchLimit(branch);
      window.setTimeout(() => {
        setSavedBranchLimit((prev) => (prev === branch ? null : prev));
      }, 1800);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Unable to save limit for ${branch}.`
      );
    } finally {
      setSavingBranchLimit(null);
    }
  };

  const handleResetBranchUsage = async (branch: BranchOption) => {
    if (!isHeadOffice) return;
    setSavingBranchLimit(branch);
    setActionError(null);
    try {
      await resetBranchCodeUsage(branch);
      setSavedBranchLimit(branch);
      window.setTimeout(() => {
        setSavedBranchLimit((prev) => (prev === branch ? null : prev));
      }, 1800);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Unable to reset count for ${branch}.`
      );
    } finally {
      setSavingBranchLimit(null);
    }
  };

  const handleApplyBulkLimit = async () => {
    if (!isHeadOffice) return;
    const parsed = Math.max(
      0,
      Math.min(10000, Math.floor(Number(bulkLimitValue) || 0))
    );
    setIsApplyingBulk(true);
    setActionError(null);
    setBulkSuccessMsg(null);
    try {
      await applyLimitToAllBranches(parsed);
      const synced: Record<string, string> = {};
      for (const b of BRANCH_OPTIONS) {
        synced[b] = String(parsed);
      }
      setLimitInputs(synced);
      setBulkSuccessMsg(
        parsed === 0
          ? 'Disabled branch code generation across all 21 branches (limit set to 0).'
          : `Set branch code generation limit to ${parsed} across all 21 branches.`
      );
      window.setTimeout(() => setBulkSuccessMsg(null), 3500);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to apply limit to all branches.'
      );
    } finally {
      setIsApplyingBulk(false);
    }
  };

  const handleCopyItem = async (key: string, text: string) => {
    await copyText(text);
    setCopiedId(key);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleCopyAllActive = async () => {
    if (activeCodes.length === 0) return;
    const lines = activeCodes.map((c) =>
      c.branch ? `${c.code} (${c.branch})` : c.code
    );
    await copyText(lines.join('\n'));
    setCopiedBatch(true);
    window.setTimeout(() => setCopiedBatch(false), 2200);
  };

  const handleRevoke = async (code: string) => {
    if (!isHeadOffice) return;
    setBusyCode(code);
    setActionError(null);
    try {
      await revokeSurveyCode(code);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to revoke survey code.'
      );
    } finally {
      setBusyCode(null);
    }
  };

  const handleDeleteRevoked = async (code: string) => {
    if (!isHeadOffice) return;
    setBusyCode(code);
    setActionError(null);
    try {
      await deleteRevokedSurveyCode(code);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete revoked code.'
      );
    } finally {
      setBusyCode(null);
    }
  };

  const canBranchGenerate = (count: number): boolean => {
    if (isHeadOffice) return true;
    return Boolean(branchQuota && branchQuota.remaining >= count);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-red-600 tracking-wide">
            {isHeadOffice
              ? 'Head Office · Single-Use Access & Branch Quota Control'
              : `${lockedBranch} Branch · Single-Use Survey Codes`}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Survey Code Activation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isHeadOffice
              ? 'Activate unlimited one-time survey codes, revoke unused codes, and set code generation limits for each branch dashboard.'
              : `Generate single-use survey codes for ${lockedBranch} within your Head Office limit. Only Head Office can revoke codes.`}
          </p>
        </div>

        {activeCodes.length > 0 && (
          <button
            type="button"
            onClick={() => void handleCopyAllActive()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {copiedBatch ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-700">
                  Copied {activeCodes.length} Active Codes
                </span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>Copy All Active ({activeCodes.length})</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Active Codes</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700 tabular-nums mt-1">
            {stats.active}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Ready for 1-time use</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Redeemed</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {stats.used}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Permanently locked</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Revoked</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-500 tabular-nums mt-1">
            {stats.revoked}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.total} total {lockedBranch ? 'in branch' : 'created'}
          </div>
        </div>
      </div>

      {/* Branch Quota Status Card (Visible to Branch Logins Only) */}
      {!isHeadOffice && branchQuota && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {lockedBranch} Generation Limit
                </h2>
                <p className="text-xs text-slate-500">
                  Configured by Head Office · Revoking codes is restricted to Head Office
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right font-mono tabular-nums">
              <div className="text-lg font-bold text-slate-900">
                {branchQuota.generatedCount}{' '}
                <span className="text-slate-400 font-normal">/</span>{' '}
                {branchQuota.maxCodes}
              </div>
              <div
                className={`text-xs font-semibold ${
                  branchQuota.remaining > 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {branchQuota.remaining}{' '}
                {branchQuota.remaining === 1 ? 'code' : 'codes'} remaining
              </div>
            </div>
          </div>

          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                branchQuota.remaining === 0 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{
                width: `${
                  branchQuota.maxCodes > 0 ? branchQuota.percentUsed : 0
                }%`,
              }}
            />
          </div>

          {branchQuota.maxCodes === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Head Office has not enabled code generation for{' '}
                <strong>{lockedBranch}</strong> yet (current limit is 0). Please ask
                Head Office to set your branch limit.
              </span>
            </div>
          ) : branchQuota.remaining === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>{lockedBranch}</strong> has reached its code generation limit (
                {branchQuota.generatedCount}/{branchQuota.maxCodes}). Contact Head Office
                to raise or reset your limit.
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Activate New Code Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Activate New Survey Code
            </h2>
            <p className="text-xs text-slate-500">
              {isHeadOffice
                ? 'Only active codes created here or by authorized branches are accepted by the survey form.'
                : `Codes generated here are automatically assigned to ${lockedBranch} and cannot be revoked by branch accounts.`}
            </p>
          </div>
        </div>

        {(error || actionError) && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{actionError || error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="code-branch"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              {isHeadOffice ? 'Assign to Branch (Optional)' : 'Assigned Branch'}
            </label>
            <div className="relative">
              <Building2
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              {isHeadOffice ? (
                <select
                  id="code-branch"
                  value={selectedBranch}
                  onChange={(e) =>
                    setSelectedBranch(e.target.value as BranchOption | '')
                  }
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Any Branch</option>
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  id="code-branch"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 flex items-center justify-between"
                >
                  <span className="truncate">{lockedBranch}</span>
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="code-note"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Reference Note (Optional)
            </label>
            <input
              id="code-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={80}
              placeholder="e.g. Lunch shift, Receipt #1042"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="custom-code"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Custom Code (Optional)
            </label>
            <div className="flex gap-2">
              <input
                id="custom-code"
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(normalizeSurveyCode(e.target.value))}
                maxLength={32}
                disabled={!canBranchGenerate(1)}
                placeholder="e.g. JN-VIP-001"
                className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50 disabled:text-slate-400 text-sm font-mono uppercase text-slate-900 placeholder:text-slate-400 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <button
                type="button"
                disabled={isActivating || customCode.length < 4 || !canBranchGenerate(1)}
                onClick={() => void handleActivateSingle(true)}
                className="px-3.5 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Activate
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isActivating || !canBranchGenerate(1)}
            onClick={() => void handleActivateSingle(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-45 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{isActivating ? 'Activating…' : 'Activate 1 Code'}</span>
          </button>
          <button
            type="button"
            disabled={isActivating || !canBranchGenerate(5)}
            onClick={() => void handleActivateBatch(5)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-45 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
          >
            <span>+ Activate 5 Codes</span>
          </button>
          <button
            type="button"
            disabled={isActivating || !canBranchGenerate(10)}
            onClick={() => void handleActivateBatch(10)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-45 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
          >
            <span>+ Activate 10 Codes</span>
          </button>
        </div>

        {/* Just-Activated Banner */}
        {recentCodes.length > 0 && (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Activated {recentCodes.length}{' '}
                  {recentCodes.length === 1 ? 'single-use code' : 'single-use codes'}
                </span>
              </div>
              {recentCodes.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyItem(
                      'recent-batch',
                      recentCodes.map((c) => c.code).join('\n')
                    )
                  }
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  {copiedId === 'recent-batch' ? 'Copied list' : 'Copy all'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recentCodes.map((rec) => {
                const link = getCustomerSurveyUrlWithCode(rec.code, rec.branch);
                return (
                  <div
                    key={rec.code}
                    className="bg-white border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-sm font-bold text-slate-900 tracking-wide truncate">
                      {rec.code}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyItem(`c-${rec.code}`, rec.code)}
                        className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        {copiedId === `c-${rec.code}` ? 'Copied' : 'Code'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyItem(`l-${rec.code}`, link)}
                        className="px-2 py-1 rounded-md text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                      >
                        {copiedId === `l-${rec.code}` ? 'Copied' : 'Link'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Head Office Exclusive: Branch Code Generation Limits Manager */}
      {isHeadOffice && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLimitsPanel((v) => !v)}
            className="w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">
                  Branch Code Generation Limits
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {configuredBranchesSummary.enabledCount} of {BRANCH_OPTIONS.length}{' '}
                  branches enabled · {configuredBranchesSummary.totalGenerated} /{' '}
                  {configuredBranchesSummary.totalQuota} total branch codes used
                </p>
              </div>
            </div>
            {showLimitsPanel ? (
              <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown
                className="w-5 h-5 text-slate-400 shrink-0"
                aria-hidden="true"
              />
            )}
          </button>

          {showLimitsPanel && (
            <div className="border-t border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="bulk-branch-limit"
                    className="text-xs font-medium text-slate-600 whitespace-nowrap"
                  >
                    Apply limit to all 21 branches:
                  </label>
                  <input
                    id="bulk-branch-limit"
                    type="number"
                    min={0}
                    max={10000}
                    value={bulkLimitValue}
                    onChange={(e) => setBulkLimitValue(e.target.value)}
                    className="w-24 h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    disabled={isApplyingBulk}
                    onClick={() => void handleApplyBulkLimit()}
                    className="px-3.5 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    {isApplyingBulk ? 'Applying…' : 'Apply to All Branches'}
                  </button>
                </div>

                <div className="relative w-full lg:w-64">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={limitSearch}
                    onChange={(e) => setLimitSearch(e.target.value)}
                    placeholder="Filter branch..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {bulkSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>{bulkSuccessMsg}</span>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4 whitespace-nowrap">Branch</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Generated / Limit</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Remaining</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Max Codes Limit</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLimitBranches.map((branch) => {
                      const rec = branchLimits[branch];
                      const maxCodes = rec ? rec.maxCodes : 0;
                      const generatedCount = rec ? rec.generatedCount : 0;
                      const remaining = Math.max(0, maxCodes - generatedCount);
                      const inputVal = limitInputs[branch] ?? String(maxCodes);
                      const isBusy = savingBranchLimit === branch;
                      const isSaved = savedBranchLimit === branch;

                      return (
                        <tr
                          key={branch}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap font-semibold text-slate-900">
                            {branch}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap font-mono tabular-nums text-slate-700">
                            {generatedCount} / {maxCodes}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap font-mono tabular-nums">
                            {maxCodes === 0 ? (
                              <span className="text-slate-400">Disabled (0)</span>
                            ) : remaining > 0 ? (
                              <span className="text-emerald-700 font-semibold">
                                {remaining} left
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold">
                                Limit reached
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <input
                              type="number"
                              min={0}
                              max={10000}
                              aria-label={`Code limit for ${branch}`}
                              value={inputVal}
                              onChange={(e) =>
                                setLimitInputs((prev) => ({
                                  ...prev,
                                  [branch]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleSaveBranchLimit(branch);
                                }
                              }}
                              className="w-24 h-8 px-2.5 rounded-lg border border-slate-300 bg-white font-mono text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSaveBranchLimit(branch)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-45 ${
                                  isSaved
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                              >
                                {isSaved ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Saved</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Save</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || generatedCount === 0}
                                onClick={() => void handleResetBranchUsage(branch)}
                                title={`Reset generated count for ${branch} to 0`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Reset</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                Set a branch limit to <span className="font-mono font-semibold">0</span>{' '}
                to prevent that branch from generating codes. Click{' '}
                <span className="font-semibold">Reset</span> to clear a branch&apos;s
                generated count back to 0 without changing its max limit.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Head Office Exclusive: Where Survey Codes Were Redeemed */}
      {isHeadOffice && stats.used > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Where Codes Were Redeemed
                </h2>
                <p className="text-xs text-slate-500">
                  Live branch breakdown of all {stats.used} redeemed{' '}
                  {stats.used === 1 ? 'code' : 'codes'}
                  {redemptionsByBranch.crossBranchCount > 0
                    ? ` · ${redemptionsByBranch.crossBranchCount} redeemed at a different branch than assigned`
                    : ''}
                  . Click any branch to filter the table below.
                </p>
              </div>
            </div>
            {redeemedBranchFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setRedeemedBranchFilter('all')}
                className="text-xs font-semibold text-red-600 hover:text-red-700 whitespace-nowrap self-start sm:self-auto"
              >
                Clear Branch Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {redemptionsByBranch.rows.map((row) => {
              const pct =
                stats.used > 0 ? Math.round((row.count / stats.used) * 100) : 0;
              const isSelected = redeemedBranchFilter === row.branch;
              return (
                <button
                  key={row.branch}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setRedeemedBranchFilter('all');
                    } else {
                      setRedeemedBranchFilter(row.branch);
                      setStatusFilter('used');
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-colors ${
                    isSelected
                      ? 'border-red-500 bg-red-50/70'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                      <MapPin
                        className="w-3.5 h-3.5 text-red-500 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{row.branch}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums shrink-0 text-slate-600">
                      <strong className="text-slate-900">{row.count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Codes Directory */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'all', label: `All (${stats.total})` },
                { id: 'active', label: `Active (${stats.active})` },
                { id: 'used', label: `Used (${stats.used})` },
                { id: 'revoked', label: `Revoked (${stats.revoked})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  if (tab.id !== 'used' && tab.id !== 'all') {
                    setRedeemedBranchFilter('all');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {isHeadOffice && redemptionsByBranch.rows.length > 0 && (
              <select
                aria-label="Filter by branch where code was redeemed"
                value={redeemedBranchFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setRedeemedBranchFilter(val);
                  if (val !== 'all') {
                    setStatusFilter('used');
                  }
                }}
                className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Redeemed At: All Branches</option>
                {redemptionsByBranch.rows.map((row) => (
                  <option key={row.branch} value={row.branch}>
                    Redeemed at {row.branch} ({row.count})
                  </option>
                ))}
              </select>
            )}

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, branch, creator, note…"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading survey codes…
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {codes.length === 0
              ? lockedBranch
                ? `No survey codes recorded for ${lockedBranch} yet.`
                : 'No survey codes activated yet. Click "Activate 1 Code" above to generate your first single-use survey code.'
              : 'No survey codes match the current filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Survey Code</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Assigned Branch</th>
                  <th className="py-3 px-4 whitespace-nowrap">Redeemed At</th>
                  <th className="py-3 px-4 whitespace-nowrap">Created By</th>
                  <th className="py-3 px-4 whitespace-nowrap">Note</th>
                  <th className="py-3 px-4 whitespace-nowrap">Created</th>
                  <th className="py-3 px-4 whitespace-nowrap">Redeemed On</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCodes.map((item) => {
                  const link = getCustomerSurveyUrlWithCode(item.code, item.branch);
                  const redemptionInfo = redemptionDetailsByCode.get(item.code);
                  return (
                    <tr
                      key={item.code}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-900 tracking-wide">
                        {item.code}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.status === 'active' ? (
                          <span className="font-semibold text-emerald-700">
                            Active
                          </span>
                        ) : item.status === 'used' ? (
                          <span className="font-medium text-slate-500">
                            Used (1/1)
                          </span>
                        ) : (
                          <span className="font-medium text-amber-700">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {item.branch || (
                          <span className="text-slate-400">Any Branch</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.status === 'used' ? (
                          redemptionInfo?.branch ? (
                            <div className="space-y-0.5">
                              <div className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                                <MapPin
                                  className="w-3.5 h-3.5 text-red-500 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>{redemptionInfo.branch}</span>
                              </div>
                              {redemptionInfo.isCrossBranch && (
                                <div className="text-[11px] font-medium text-amber-700">
                                  Different from assigned branch
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Unspecified</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 text-xs">
                        {item.createdBy}
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-slate-600">
                        {item.note || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-500 tabular-nums">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-500 tabular-nums">
                        {item.status === 'used' ? (
                          <div>
                            <div>{formatDateTime(item.usedAt)}</div>
                            {item.usedByResponseId && (
                              <div className="text-[11px] text-slate-400">
                                {item.usedByResponseId}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {item.status === 'active' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCopyItem(`row-c-${item.code}`, item.code)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
                              >
                                {copiedId === `row-c-${item.code}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                )}
                                <span>
                                  {copiedId === `row-c-${item.code}`
                                    ? 'Copied'
                                    : 'Code'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCopyItem(`row-l-${item.code}`, link)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-50 text-xs font-medium text-red-700 transition-colors"
                              >
                                {copiedId === `row-l-${item.code}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Link2 className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <span>
                                  {copiedId === `row-l-${item.code}`
                                    ? 'Copied'
                                    : 'Link'}
                                </span>
                              </button>
                              {isHeadOffice && (
                                <button
                                  type="button"
                                  aria-label={`Revoke code ${item.code}`}
                                  disabled={busyCode === item.code}
                                  onClick={() => void handleRevoke(item.code)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-40"
                                  title="Revoke code (Head Office only)"
                                >
                                  <Ban className="w-4 h-4" aria-hidden="true" />
                                </button>
                              )}
                            </>
                          )}
                          {item.status === 'revoked' && isHeadOffice && (
                            <button
                              type="button"
                              aria-label={`Delete revoked code ${item.code}`}
                              disabled={busyCode === item.code}
                              onClick={() => void handleDeleteRevoked(item.code)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="Delete revoked code (Head Office only)"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                          {item.status === 'revoked' && !isHeadOffice && (
                            <span className="text-[11px] text-amber-700 font-medium">
                              Revoked by HO
                            </span>
                          )}
                          {item.status === 'used' && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isHeadOffice && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 text-xs text-slate-500 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span>
              Branch dashboards can generate and copy codes within their Head Office limit,
              but only Head Office can revoke or remove survey codes.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
