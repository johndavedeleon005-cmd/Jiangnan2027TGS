import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BRANCH_OPTIONS,
  getBranchLimitDocId,
  getLocalDateString,
  isValidSurveyCodeFormat,
  normalizeBranchName,
  normalizeSurveyCode,
  type BranchCodeLimitRecord,
  type BranchOption,
  type SurveyCodeRecord,
} from '../types/survey';
import { getBaseAppUrl } from './surveyStorage';

export const SURVEY_CODES_COLLECTION = 'surveyCodes';
export const BRANCH_CODE_LIMITS_COLLECTION = 'branchCodeLimits';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomBlock(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx];
  }
  return out;
}

export function generateRandomSurveyCode(): string {
  return `JN-${randomBlock(4)}-${randomBlock(4)}`;
}

export function getCustomerSurveyUrlWithCode(
  code: string,
  branch?: BranchOption | null
): string {
  const params = new URLSearchParams();
  if (branch) params.set('branch', branch);
  params.set('code', code);
  const suffix = `?${params.toString()}`;
  if (typeof window === 'undefined') return `#/survey${suffix}`;
  return `${getBaseAppUrl()}#/survey${suffix}`;
}

function sortCodesNewestFirst(items: SurveyCodeRecord[]): SurveyCodeRecord[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function subscribeToSurveyCodes(
  onUpdate: (codes: SurveyCodeRecord[]) => void,
  onError?: (error: Error) => void,
  branchFilter?: BranchOption | null
): () => void {
  const codesQuery = branchFilter
    ? query(
        collection(db, SURVEY_CODES_COLLECTION),
        where('branch', '==', branchFilter)
      )
    : query(
        collection(db, SURVEY_CODES_COLLECTION),
        where('status', 'in', ['active', 'used', 'revoked'])
      );

  return onSnapshot(
    codesQuery,
    (snapshot) => {
      const items = snapshot.docs.map(
        (docSnap) => docSnap.data() as SurveyCodeRecord
      );
      onUpdate(sortCodesNewestFirst(items));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, SURVEY_CODES_COLLECTION);
      } catch (formattedErr) {
        if (onError && formattedErr instanceof Error) {
          onError(formattedErr);
        }
      }
    }
  );
}

export function subscribeToBranchCodeLimits(
  onUpdate: (limits: Record<string, BranchCodeLimitRecord>) => void,
  onError?: (error: Error) => void,
  branchFilter?: BranchOption | null
): () => void {
  if (branchFilter) {
    const docId = getBranchLimitDocId(branchFilter);
    const limitRef = doc(db, BRANCH_CODE_LIMITS_COLLECTION, docId);
    return onSnapshot(
      limitRef,
      (snap) => {
        if (snap.exists()) {
          const record = snap.data() as BranchCodeLimitRecord;
          onUpdate({ [record.branch]: record });
        } else {
          onUpdate({});
        }
      },
      (error) => {
        try {
          handleFirestoreError(
            error,
            OperationType.GET,
            `${BRANCH_CODE_LIMITS_COLLECTION}/${docId}`
          );
        } catch (formattedErr) {
          if (onError && formattedErr instanceof Error) {
            onError(formattedErr);
          }
        }
      }
    );
  }

  const limitsQuery = query(
    collection(db, BRANCH_CODE_LIMITS_COLLECTION),
    where('updatedBy', '==', 'Head Office')
  );

  return onSnapshot(
    limitsQuery,
    (snapshot) => {
      const map: Record<string, BranchCodeLimitRecord> = {};
      for (const docSnap of snapshot.docs) {
        const record = docSnap.data() as BranchCodeLimitRecord;
        map[record.branch] = record;
      }
      onUpdate(map);
    },
    (error) => {
      try {
        handleFirestoreError(
          error,
          OperationType.LIST,
          BRANCH_CODE_LIMITS_COLLECTION
        );
      } catch (formattedErr) {
        if (onError && formattedErr instanceof Error) {
          onError(formattedErr);
        }
      }
    }
  );
}

export async function setBranchCodeLimit(
  branch: BranchOption,
  maxCodesInput: number,
  options: { resetCount?: boolean } = {}
): Promise<BranchCodeLimitRecord> {
  const maxCodes = Math.max(0, Math.min(10000, Math.floor(Number(maxCodesInput) || 0)));
  const docId = getBranchLimitDocId(branch);
  const limitRef = doc(db, BRANCH_CODE_LIMITS_COLLECTION, docId);
  const docPath = `${BRANCH_CODE_LIMITS_COLLECTION}/${docId}`;

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(limitRef);
      const prevCount = snap.exists()
        ? Math.max(0, Math.floor(Number((snap.data() as BranchCodeLimitRecord).generatedCount) || 0))
        : 0;

      const record: BranchCodeLimitRecord = {
        id: docId,
        branch,
        maxCodes,
        generatedCount: options.resetCount ? 0 : prevCount,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Head Office',
      };

      transaction.set(limitRef, record);
      return record;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function applyLimitToAllBranches(
  maxCodesInput: number,
  options: { resetCount?: boolean } = {}
): Promise<void> {
  const maxCodes = Math.max(0, Math.min(10000, Math.floor(Number(maxCodesInput) || 0)));
  await Promise.all(
    BRANCH_OPTIONS.map((branch) =>
      setBranchCodeLimit(branch, maxCodes, options)
    )
  );
}

export async function resetBranchCodeUsage(
  branch: BranchOption
): Promise<BranchCodeLimitRecord> {
  const docId = getBranchLimitDocId(branch);
  const limitRef = doc(db, BRANCH_CODE_LIMITS_COLLECTION, docId);
  const docPath = `${BRANCH_CODE_LIMITS_COLLECTION}/${docId}`;

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(limitRef);
      const prevMax = snap.exists()
        ? Math.max(0, Math.floor(Number((snap.data() as BranchCodeLimitRecord).maxCodes) || 0))
        : 0;

      const record: BranchCodeLimitRecord = {
        id: docId,
        branch,
        maxCodes: prevMax,
        generatedCount: 0,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Head Office',
      };

      transaction.set(limitRef, record);
      return record;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export interface ActivateSurveyCodeInput {
  customCode?: string;
  branch?: BranchOption | '';
  note?: string;
}

export async function activateSurveyCode(
  input: ActivateSurveyCodeInput = {}
): Promise<SurveyCodeRecord> {
  const normalized = input.customCode
    ? normalizeSurveyCode(input.customCode)
    : generateRandomSurveyCode();

  if (!isValidSurveyCodeFormat(normalized)) {
    throw new Error(
      'Survey code must be 4–32 characters using letters, numbers, hyphens, or underscores.'
    );
  }

  const codeRef = doc(db, SURVEY_CODES_COLLECTION, normalized);
  const existingSnap = await getDoc(codeRef);
  if (existingSnap.exists()) {
    const existingData = existingSnap.data() as SurveyCodeRecord;
    if (existingData.status === 'used') {
      throw new Error(
        `Code "${normalized}" was already used and cannot be reactivated.`
      );
    }
    throw new Error(`Code "${normalized}" already exists. Choose a different code.`);
  }

  const now = new Date();
  const branch = normalizeBranchName(input.branch);
  const note = String(input.note || '').trim().slice(0, 80);

  const record: SurveyCodeRecord = {
    code: normalized,
    status: 'active',
    createdAt: now.toISOString(),
    createdDate: getLocalDateString(now),
    createdBy: 'Head Office',
  };

  if (branch) {
    record.branch = branch;
  }
  if (note) {
    record.note = note;
  }

  const docPath = `${SURVEY_CODES_COLLECTION}/${record.code}`;
  try {
    await setDoc(codeRef, record);
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function activateSurveyCodeBatch(
  count: number,
  options: { branch?: BranchOption | ''; note?: string } = {}
): Promise<SurveyCodeRecord[]> {
  const safeCount = Math.max(1, Math.min(25, Math.round(count)));
  const created: SurveyCodeRecord[] = [];
  for (let i = 0; i < safeCount; i += 1) {
    const rec = await activateSurveyCode({
      branch: options.branch,
      note: options.note,
    });
    created.push(rec);
  }
  return created;
}

export interface ActivateBranchCodesInput {
  count?: number;
  customCode?: string;
  note?: string;
}

/**
 * Atomically generates 1 or more single-use survey codes for a specific branch,
 * strictly enforcing an exact +1 quota increment per code in /branchCodeLimits/{branchId}.
 */
export async function activateBranchSurveyCodes(
  branch: BranchOption,
  input: ActivateBranchCodesInput = {}
): Promise<SurveyCodeRecord[]> {
  const isCustom = Boolean(input.customCode && input.customCode.trim());
  const requestedCount = isCustom
    ? 1
    : Math.max(1, Math.min(10, Math.round(input.count ?? 1)));

  const note = String(input.note || '').trim().slice(0, 80);
  const limitDocId = getBranchLimitDocId(branch);
  const limitRef = doc(db, BRANCH_CODE_LIMITS_COLLECTION, limitDocId);
  const docPath = `${BRANCH_CODE_LIMITS_COLLECTION}/${limitDocId}`;

  // Pre-check available quota so batch requests fail fast before generating partial codes
  const preSnap = await getDoc(limitRef);
  if (!preSnap.exists()) {
    throw new Error(
      `Head Office has not enabled survey code generation for ${branch} yet (limit is 0).`
    );
  }
  const preData = preSnap.data() as BranchCodeLimitRecord;
  const preMax = Math.max(0, Math.floor(Number(preData.maxCodes) || 0));
  const preCount = Math.max(0, Math.floor(Number(preData.generatedCount) || 0));
  if (preMax <= 0) {
    throw new Error(
      `Code generation is currently disabled for ${branch} (limit set to 0 by Head Office).`
    );
  }
  const preRemaining = Math.max(0, preMax - preCount);
  if (requestedCount > preRemaining) {
    throw new Error(
      preRemaining === 0
        ? `${branch} has reached its survey code limit (${preCount}/${preMax}). Ask Head Office to increase your limit.`
        : `Only ${preRemaining} code${preRemaining === 1 ? '' : 's'} remaining under ${branch}'s Head Office limit (${preCount}/${preMax}).`
    );
  }

  const created: SurveyCodeRecord[] = [];

  for (let i = 0; i < requestedCount; i += 1) {
    const targetCode = isCustom
      ? normalizeSurveyCode(input.customCode)
      : generateRandomSurveyCode();

    if (!isValidSurveyCodeFormat(targetCode)) {
      throw new Error(
        'Survey code must be 4–32 characters using letters, numbers, hyphens, or underscores.'
      );
    }

    const codeRef = doc(db, SURVEY_CODES_COLLECTION, targetCode);

    try {
      const record = await runTransaction(db, async (transaction) => {
        const limitSnap = await transaction.get(limitRef);
        if (!limitSnap.exists()) {
          throw new Error(
            `Head Office has not enabled survey code generation for ${branch} yet (limit is 0).`
          );
        }

        const limitData = limitSnap.data() as BranchCodeLimitRecord;
        const maxCodes = Math.max(0, Math.floor(Number(limitData.maxCodes) || 0));
        const currentCount = Math.max(
          0,
          Math.floor(Number(limitData.generatedCount) || 0)
        );

        if (maxCodes <= 0) {
          throw new Error(
            `Code generation is currently disabled for ${branch} (limit set to 0 by Head Office).`
          );
        }

        if (currentCount >= maxCodes) {
          throw new Error(
            `${branch} has reached its survey code limit (${currentCount}/${maxCodes}). Ask Head Office to increase your limit.`
          );
        }

        const codeSnap = await transaction.get(codeRef);
        if (codeSnap.exists()) {
          const existingData = codeSnap.data() as SurveyCodeRecord;
          if (existingData.status === 'used') {
            throw new Error(
              `Code "${targetCode}" was already used and cannot be reactivated.`
            );
          }
          throw new Error(
            `Code "${targetCode}" already exists. Choose a different code.`
          );
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const nextRecord: SurveyCodeRecord = {
          code: targetCode,
          status: 'active',
          createdAt: nowIso,
          createdDate: getLocalDateString(now),
          createdBy: branch,
          branch,
        };
        if (note) {
          nextRecord.note = note;
        }

        transaction.set(codeRef, nextRecord);
        transaction.update(limitRef, {
          generatedCount: currentCount + 1,
          updatedAt: nowIso,
        });

        return nextRecord;
      });

      created.push(record);
    } catch (error) {
      if (
        error instanceof Error &&
        /Head Office|limit|already exists|already used|4–32 characters|disabled/i.test(
          error.message
        )
      ) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }

  return created;
}

export type VerifySurveyCodeResult =
  | { valid: true; record: SurveyCodeRecord }
  | {
      valid: false;
      reason: 'invalid_format' | 'not_found' | 'used' | 'revoked';
      message: string;
    };

export async function verifySurveyCode(
  rawCode: string
): Promise<VerifySurveyCodeResult> {
  const normalized = normalizeSurveyCode(rawCode);
  if (!isValidSurveyCodeFormat(normalized)) {
    return {
      valid: false,
      reason: 'invalid_format',
      message: 'Please enter a valid survey code (e.g. JN-XXXX-XXXX).',
    };
  }

  const docPath = `${SURVEY_CODES_COLLECTION}/${normalized}`;
  try {
    const snap = await getDoc(doc(db, SURVEY_CODES_COLLECTION, normalized));
    if (!snap.exists()) {
      return {
        valid: false,
        reason: 'not_found',
        message:
          'Survey code not found. Please check the code or request an active code from the dashboard.',
      };
    }

    const record = snap.data() as SurveyCodeRecord;
    if (record.status === 'used') {
      return {
        valid: false,
        reason: 'used',
        message:
          'This survey code has already been used. Each code can only be used once.',
      };
    }
    if (record.status === 'revoked') {
      return {
        valid: false,
        reason: 'revoked',
        message: 'This survey code has been deactivated and is no longer valid.',
      };
    }

    return { valid: true, record };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function revokeSurveyCode(code: string): Promise<boolean> {
  const normalized = normalizeSurveyCode(code);
  const docPath = `${SURVEY_CODES_COLLECTION}/${normalized}`;
  try {
    await updateDoc(doc(db, SURVEY_CODES_COLLECTION, normalized), {
      status: 'revoked',
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteRevokedSurveyCode(code: string): Promise<boolean> {
  const normalized = normalizeSurveyCode(code);
  const docPath = `${SURVEY_CODES_COLLECTION}/${normalized}`;
  try {
    await deleteDoc(doc(db, SURVEY_CODES_COLLECTION, normalized));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
