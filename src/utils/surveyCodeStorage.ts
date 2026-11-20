import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  getLocalDateString,
  isValidSurveyCodeFormat,
  normalizeBranchName,
  normalizeSurveyCode,
  type BranchOption,
  type SurveyCodeRecord,
} from '../types/survey';
import { getBaseAppUrl } from './surveyStorage';

export const SURVEY_CODES_COLLECTION = 'surveyCodes';

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
  onError?: (error: Error) => void
): () => void {
  const codesQuery = query(
    collection(db, SURVEY_CODES_COLLECTION),
    where('createdBy', '==', 'Head Office')
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
          'Survey code not found. Please check the code or request an active code from Head Office.',
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
