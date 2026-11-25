import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  getLocalDateString,
  getTransportCategory,
  isValidSurveyCodeFormat,
  normalizeBranchName,
  normalizeSurveyCode,
  type AgeGroupOption,
  type BranchOption,
  type CurrencyCode,
  type DiningCompanionOption,
  type GenderOption,
  type OccupationOption,
  type OnlineSoloAwarenessOption,
  type RelationshipStatusOption,
  type SurveyCodeRecord,
  type SurveyResponse,
  type TransportModeOption,
  type VisitFrequencyOption,
} from '../types/survey';

const LOCAL_STORAGE_KEY = 'jiangnan_survey_responses_v1';
const COLLECTION_PATH = 'surveys';
const SURVEY_CODES_COLLECTION = 'surveyCodes';

const VALID_GENDERS: GenderOption[] = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer not to say',
];

const VALID_AGE_GROUPS: AgeGroupOption[] = [
  'Under 18',
  '18–24',
  '25–34',
  '35–44',
  '45–54',
  '55+',
];

const VALID_OCCUPATIONS: OccupationOption[] = [
  'Student',
  'Employed',
  'Unemployed',
];

const VALID_RELATIONSHIPS: RelationshipStatusOption[] = [
  'Single',
  'In a Relationship',
  'Married',
  'Prefer not to say',
];

const VALID_COMPANIONS: DiningCompanionOption[] = [
  'Solo',
  'Friends',
  'Family',
];

const VALID_TRANSPORTS: TransportModeOption[] = [
  'Private Car',
  'Private Motorcycle',
  'Private Tricycle',
  'Public Mototaxi',
  'Public Tricycle',
  'Ride-Hailing App (Grab)',
  'Walked Only',
];

const VALID_VISIT_FREQUENCIES: VisitFrequencyOption[] = [
  'First Time',
  '2nd Time',
  '3 or More Times',
];

export function getBaseAppUrl(): string {
  if (typeof window === 'undefined') return '';
  const cleanPath = window.location.pathname
    .replace(/\/index\.html$/, '/')
    .replace(/\/(survey|responses)\/?$/, '/')
    .replace(/\/?$/, '/');
  return `${window.location.origin}${cleanPath}`;
}

export function getCustomerSurveyUrl(branch?: BranchOption | null): string {
  const suffix = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  if (typeof window === 'undefined') return `#/survey${suffix}`;
  return `${getBaseAppUrl()}#/survey${suffix}`;
}

function readLocalResponses(): SurveyResponse[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalResponses(items: SurveyResponse[]): void {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } else {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // Ignore storage errors
  }
}

function sanitizeSurveyResponse(raw: Partial<SurveyResponse>): SurveyResponse {
  const safeId =
    String(raw.id || '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64) ||
    `SRV-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date();
  const submittedAt =
    typeof raw.submittedAt === 'string' &&
    raw.submittedAt.length >= 10 &&
    raw.submittedAt.length <= 40
      ? raw.submittedAt
      : now.toISOString();
  const submittedDate =
    typeof raw.submittedDate === 'string' &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw.submittedDate)
      ? raw.submittedDate
      : getLocalDateString(now);

  const normalizedBranch = normalizeBranchName(raw.branch);

  const gender: GenderOption = VALID_GENDERS.includes(
    raw.gender as GenderOption
  )
    ? (raw.gender as GenderOption)
    : 'Prefer not to say';

  const normalizedAge = String(raw.ageGroup || '').replace(/-/g, '–') as AgeGroupOption;
  const ageGroup: AgeGroupOption = VALID_AGE_GROUPS.includes(normalizedAge)
    ? normalizedAge
    : '25–34';

  const occupation: OccupationOption = VALID_OCCUPATIONS.includes(
    raw.occupation as OccupationOption
  )
    ? (raw.occupation as OccupationOption)
    : 'Employed';

  const relationshipStatus: RelationshipStatusOption =
    VALID_RELATIONSHIPS.includes(
      raw.relationshipStatus as RelationshipStatusOption
    )
      ? (raw.relationshipStatus as RelationshipStatusOption)
      : 'Prefer not to say';

  const diningWith: DiningCompanionOption = VALID_COMPANIONS.includes(
    raw.diningWith as DiningCompanionOption
  )
    ? (raw.diningWith as DiningCompanionOption)
    : 'Solo';

  const partySize =
    diningWith === 'Solo'
      ? 1
      : Math.min(50, Math.max(1, Math.round(Number(raw.partySize) || 2)));

  const transportMode: TransportModeOption = VALID_TRANSPORTS.includes(
    raw.transportMode as TransportModeOption
  )
    ? (raw.transportMode as TransportModeOption)
    : 'Private Car';

  const spendEstimate = Math.min(
    1000000,
    Math.max(0, Math.round(Number(raw.spendEstimate) || 0))
  );

  const base: SurveyResponse = {
    id: safeId,
    submittedAt,
    submittedDate,
    consent: 'Yes',
    name: String(raw.name || '').trim().slice(0, 80),
    gender,
    ageGroup,
    occupation,
    relationshipStatus,
    diningWith,
    partySize,
    transportCategory: getTransportCategory(transportMode),
    transportMode,
    origin: String(raw.origin || 'Other').trim().slice(0, 80) || 'Other',
    destination:
      String(raw.destination || 'Other').trim().slice(0, 80) || 'Other',
    currency: raw.currency === 'USD' ? 'USD' : 'PHP',
    spendPerPax:
      String(raw.spendPerPax || 'Unspecified').trim().slice(0, 80) ||
      'Unspecified',
    spendEstimate,
    orderedTakeout: Boolean(raw.orderedTakeout),
    paymentMethod:
      String(raw.paymentMethod || 'Cash').trim().slice(0, 60) || 'Cash',
  };

  if (normalizedBranch) {
    base.branch = normalizedBranch;
  }

  const normalizedCode = normalizeSurveyCode(raw.surveyCode);
  if (isValidSurveyCodeFormat(normalizedCode)) {
    base.surveyCode = normalizedCode;
  }

  if (raw.awareOnlineSoloMeal === 'Yes' || raw.awareOnlineSoloMeal === 'No') {
    base.awareOnlineSoloMeal = raw.awareOnlineSoloMeal;
  }

  if (
    VALID_VISIT_FREQUENCIES.includes(raw.visitFrequency as VisitFrequencyOption)
  ) {
    base.visitFrequency = raw.visitFrequency as VisitFrequencyOption;
  }

  return base;
}

function sortResponsesNewestFirst(items: SurveyResponse[]): SurveyResponse[] {
  return [...items].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt)
  );
}

let isMigrating = false;

export async function migrateExistingLocalResponses(): Promise<void> {
  if (isMigrating || typeof window === 'undefined') return;
  const localItems = readLocalResponses();
  if (localItems.length === 0) return;

  isMigrating = true;
  const remaining: SurveyResponse[] = [];

  try {
    for (const item of localItems) {
      const clean = sanitizeSurveyResponse(item);
      if (!clean.surveyCode) {
        continue;
      }
      try {
        await setDoc(doc(db, COLLECTION_PATH, clean.id), clean);
      } catch {
        remaining.push(item);
      }
    }
    writeLocalResponses(remaining);
  } finally {
    isMigrating = false;
  }
}

if (typeof window !== 'undefined') {
  void migrateExistingLocalResponses();
}

export function subscribeToSurveyResponses(
  onUpdate: (responses: SurveyResponse[]) => void,
  onError?: (error: Error) => void
): () => void {
  void migrateExistingLocalResponses();

  const surveysQuery = query(
    collection(db, COLLECTION_PATH),
    where('consent', '==', 'Yes')
  );

  return onSnapshot(
    surveysQuery,
    (snapshot) => {
      const items: SurveyResponse[] = snapshot.docs.map(
        (docSnap) => docSnap.data() as SurveyResponse
      );
      onUpdate(sortResponsesNewestFirst(items));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_PATH);
      } catch (formattedErr) {
        if (onError && formattedErr instanceof Error) {
          onError(formattedErr);
        }
      }
    }
  );
}

export async function loadSurveyResponses(): Promise<SurveyResponse[]> {
  await migrateExistingLocalResponses();
  try {
    const surveysQuery = query(
      collection(db, COLLECTION_PATH),
      where('consent', '==', 'Yes')
    );
    const snapshot = await getDocs(surveysQuery);
    const items = snapshot.docs.map(
      (docSnap) => docSnap.data() as SurveyResponse
    );
    return sortResponsesNewestFirst(items);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_PATH);
  }
}

export interface SubmitSurveyPayload {
  consent: 'Yes' | 'No' | '';
  surveyCode: string;
  branch?: BranchOption | '';
  name: string;
  gender: SurveyResponse['gender'];
  ageGroup: SurveyResponse['ageGroup'];
  occupation: SurveyResponse['occupation'];
  relationshipStatus: SurveyResponse['relationshipStatus'];
  diningWith: DiningCompanionOption;
  visitFrequency?: VisitFrequencyOption;
  partySize: number;
  transportMode: TransportModeOption;
  origin: string;
  destination: string;
  currency: CurrencyCode;
  spendPerPax: string;
  spendEstimate: number;
  orderedTakeout?: boolean;
  paymentMethod: string;
  awareOnlineSoloMeal?: OnlineSoloAwarenessOption;
  clientDate: string;
}

export async function submitSurveyResponse(
  payload: SubmitSurveyPayload
): Promise<SurveyResponse> {
  if (payload.consent !== 'Yes') {
    throw new Error('Participant consent is required to submit.');
  }

  const normalizedCode = normalizeSurveyCode(payload.surveyCode);
  if (!isValidSurveyCodeFormat(normalizedCode)) {
    throw new Error('A valid activated survey code is required to submit.');
  }

  const now = new Date();
  const id = `SRV-${now.getTime().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  const entry = sanitizeSurveyResponse({
    id,
    submittedAt: now.toISOString(),
    submittedDate: payload.clientDate || getLocalDateString(now),
    surveyCode: normalizedCode,
    branch: payload.branch || undefined,
    consent: 'Yes',
    name: payload.name,
    gender: payload.gender,
    ageGroup: payload.ageGroup,
    occupation: payload.occupation,
    relationshipStatus: payload.relationshipStatus,
    diningWith: payload.diningWith,
    visitFrequency: payload.visitFrequency,
    partySize: payload.diningWith === 'Solo' ? 1 : payload.partySize,
    transportCategory: getTransportCategory(payload.transportMode),
    transportMode: payload.transportMode,
    origin: payload.origin,
    destination: payload.destination,
    currency: payload.currency,
    spendPerPax: payload.spendPerPax,
    spendEstimate: payload.spendEstimate,
    orderedTakeout: Boolean(payload.orderedTakeout),
    paymentMethod: payload.paymentMethod,
    awareOnlineSoloMeal: payload.awareOnlineSoloMeal,
  });

  const docPath = `${COLLECTION_PATH}/${entry.id}`;
  try {
    await runTransaction(db, async (transaction) => {
      const codeRef = doc(db, SURVEY_CODES_COLLECTION, normalizedCode);
      const codeSnap = await transaction.get(codeRef);
      if (!codeSnap.exists()) {
        throw new Error(
          'Survey code not found. Please request an active code from Head Office.'
        );
      }
      const codeData = codeSnap.data() as SurveyCodeRecord;
      if (codeData.status === 'used') {
        throw new Error(
          'This survey code has already been used. Each survey code can only be used once.'
        );
      }
      if (codeData.status !== 'active') {
        throw new Error(
          'This survey code has been deactivated and can no longer be used.'
        );
      }

      const surveyRef = doc(db, COLLECTION_PATH, entry.id);
      transaction.set(surveyRef, entry);
      const codeUpdate: Record<string, string> = {
        status: 'used',
        usedAt: entry.submittedAt,
        usedByResponseId: entry.id,
      };
      if (entry.branch) {
        codeUpdate.usedAtBranch = entry.branch;
      }
      transaction.update(codeRef, codeUpdate);
    });

    return entry;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('survey code') ||
        error.message.includes('Survey code'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteSurveyResponseById(id: string): Promise<boolean> {
  const docPath = `${COLLECTION_PATH}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTION_PATH, id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function clearAllSurveyResponses(): Promise<boolean> {
  try {
    const surveysQuery = query(
      collection(db, COLLECTION_PATH),
      where('consent', '==', 'Yes')
    );
    const snapshot = await getDocs(surveysQuery);
    await Promise.all(
      snapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, COLLECTION_PATH, docSnap.id))
      )
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_PATH);
  }
}

export async function clearBranchSurveyResponses(branch: BranchOption): Promise<boolean> {
  try {
    const surveysQuery = query(
      collection(db, COLLECTION_PATH),
      where('consent', '==', 'Yes')
    );
    const snapshot = await getDocs(surveysQuery);
    const branchDocs = snapshot.docs.filter(
      (docSnap) => (docSnap.data() as SurveyResponse).branch === branch
    );
    await Promise.all(
      branchDocs.map((docSnap) =>
        deleteDoc(doc(db, COLLECTION_PATH, docSnap.id))
      )
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_PATH);
  }
}
