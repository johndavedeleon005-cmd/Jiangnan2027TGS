import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  BRANCH_OPTIONS,
  normalizeSurveyCode,
  type BranchOption,
  type SurveyCodeRecord,
  type SurveyCodeStatus,
} from '../types/survey';
import {
  activateSurveyCode,
  activateSurveyCodeBatch,
  deleteRevokedSurveyCode,
  getCustomerSurveyUrlWithCode,
  revokeSurveyCode,
} from '../utils/surveyCodeStorage';

interface SurveyCodesViewProps {
  codes: SurveyCodeRecord[];
  isLoading: boolean;
  error: string | null;
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
  isLoading,
  error,
}: SurveyCodesViewProps) {
  const [selectedBranch, setSelectedBranch] = useState<BranchOption | ''>('');
  const [customCode, setCustomCode] = useState('');
  const [note, setNote] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recentCodes, setRecentCodes] = useState<SurveyCodeRecord[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | SurveyCodeStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

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

  const filteredCodes = useMemo(() => {
    let list = codes;
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          (c.branch || 'any branch').toLowerCase().includes(q) ||
          (c.note || '').toLowerCase().includes(q) ||
          (c.usedByResponseId || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [codes, statusFilter, searchQuery]);

  const activeCodes = useMemo(
    () => codes.filter((c) => c.status === 'active'),
    [codes]
  );

  const handleActivateSingle = async (useCustom: boolean) => {
    setIsActivating(true);
    setActionError(null);
    try {
      const created = await activateSurveyCode({
        customCode: useCustom ? customCode : undefined,
        branch: selectedBranch,
        note,
      });
      setRecentCodes([created]);
      if (useCustom) setCustomCode('');
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
      const created = await activateSurveyCodeBatch(count, {
        branch: selectedBranch,
        note,
      });
      setRecentCodes(created);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to activate batch of codes.'
      );
    } finally {
      setIsActivating(false);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-red-600 tracking-wide">
            Head Office Exclusive · Single-Use Access Control
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Survey Code Activation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate and activate one-time survey codes. Each code can only be redeemed
            once during the survey consent step.
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
            {stats.total} total created
          </div>
        </div>
      </div>

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
              Only codes activated here are accepted by the survey form.
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
              Assign to Branch (Optional)
            </label>
            <div className="relative">
              <Building2
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
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
                placeholder="e.g. JN-VIP-001"
                className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-mono uppercase text-slate-900 placeholder:text-slate-400 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <button
                type="button"
                disabled={isActivating || customCode.length < 4}
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
            disabled={isActivating}
            onClick={() => void handleActivateSingle(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{isActivating ? 'Activating…' : 'Activate 1 Code'}</span>
          </button>
          <button
            type="button"
            disabled={isActivating}
            onClick={() => void handleActivateBatch(5)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
          >
            <span>+ Activate 5 Codes</span>
          </button>
          <button
            type="button"
            disabled={isActivating}
            onClick={() => void handleActivateBatch(10)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
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

      {/* Codes Directory */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                onClick={() => setStatusFilter(tab.id)}
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

          <div className="relative w-full sm:w-64">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, branch, note…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading survey codes…
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {codes.length === 0
              ? 'No survey codes activated yet. Click "Activate 1 Code" above to generate your first single-use survey code.'
              : 'No survey codes match the current filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Survey Code</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Branch</th>
                  <th className="py-3 px-4 whitespace-nowrap">Note</th>
                  <th className="py-3 px-4 whitespace-nowrap">Created</th>
                  <th className="py-3 px-4 whitespace-nowrap">Redeemed</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCodes.map((item) => {
                  const link = getCustomerSurveyUrlWithCode(item.code, item.branch);
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
                      <td className="py-3 px-4 max-w-[200px] truncate text-slate-600">
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
                              <button
                                type="button"
                                aria-label={`Revoke code ${item.code}`}
                                disabled={busyCode === item.code}
                                onClick={() => void handleRevoke(item.code)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-40"
                                title="Revoke code"
                              >
                                <Ban className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          {item.status === 'revoked' && (
                            <button
                              type="button"
                              aria-label={`Delete revoked code ${item.code}`}
                              disabled={busyCode === item.code}
                              onClick={() => void handleDeleteRevoked(item.code)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="Delete revoked code"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
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
      </div>
    </div>
  );
}
