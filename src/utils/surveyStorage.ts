import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  getLocalDateString,
  getTransportCategory,
  type CurrencyCode,
  type DiningCompanionOption,
  type SurveyResponse,
  type TransportModeOption,
} from '../types/survey';

const LOCAL_STORAGE_KEY = 'jiangnan_survey_responses_v1';
const COLLECTION_PATH = 'surveys';

export function getBaseAppUrl(): string {
  if (typeof window === 'undefined') return '';
  const cleanPath = window.location.pathname
    .replace(/\/index\.html$/, '/')
    .replace(/\/(survey|responses)\/?$/, '/')
    .replace(/\/?$/, '/');
  return `${window.location.origin}${cleanPath}`;
}

export function getCustomerSurveyUrl(): string {
  if (typeof window === 'undefined') return '#/survey';
  return `${getBaseAppUrl()}#/survey`;
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

function clearLocalResponses(): void {
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function sanitizeSurveyResponse(raw: SurveyResponse): SurveyResponse {
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

  const diningWith: DiningCompanionOption =
    raw.diningWith === 'Solo' ||
    raw.diningWith === 'Friends' ||
    raw.diningWith === 'Family'
      ? raw.diningWith
      : 'Solo';

  const partySize =
    diningWith === 'Solo'
      ? 1
      : Math.min(50, Math.max(1, Math.round(Number(raw.partySize) || 2)));

  const spendEstimate = Math.min(
    1000000,
    Math.max(0, Math.round(Number(raw.spendEstimate) || 0))
  );

  return {
    id: safeId,
    submittedAt,
    submittedDate,
    consent: 'Yes',
    name: String(raw.name || '').trim().slice(0, 80),
    gender: raw.gender,
    ageGroup: raw.ageGroup,
    occupation: raw.occupation || 'Employed',
    relationshipStatus: raw.relationshipStatus || 'Prefer not to say',
    diningWith,
    partySize,
    transportCategory: getTransportCategory(raw.transportMode),
    transportMode: raw.transportMode,
    origin: String(raw.origin || 'Other').trim().slice(0, 80) || 'Other',
    destination:
      String(raw.destination || 'Other').trim().slice(0, 80) || 'Other',
    currency: raw.currency === 'USD' ? 'USD' : 'PHP',
    spendPerPax:
      String(raw.spendPerPax || 'Unspecified').trim().slice(0, 40) ||
      'Unspecified',
    spendEstimate,
    paymentMethod:
      String(raw.paymentMethod || 'Cash').trim().slice(0, 60) || 'Cash',
  };
}

function sortResponsesNewestFirst(items: SurveyResponse[]): SurveyResponse[] {
  return [...items].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt)
  );
}

let hasMigratedLocal = false;

async function migrateExistingLocalResponses(): Promise<void> {
  if (hasMigratedLocal || typeof window === 'undefined') return;
  hasMigratedLocal = true;

  const localItems = readLocalResponses();
  if (localItems.length === 0) return;

  try {
    await Promise.all(
      localItems.map(async (item) => {
        const clean = sanitizeSurveyResponse(item);
        await setDoc(doc(db, COLLECTION_PATH, clean.id), clean);
      })
    );
    clearLocalResponses();
  } catch {
    // Keep local items if offline
  }
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
  name: string;
  gender: SurveyResponse['gender'];
  ageGroup: SurveyResponse['ageGroup'];
  occupation: SurveyResponse['occupation'];
  relationshipStatus: SurveyResponse['relationshipStatus'];
  diningWith: DiningCompanionOption;
  partySize: number;
  transportMode: TransportModeOption;
  origin: string;
  destination: string;
  currency: CurrencyCode;
  spendPerPax: string;
  spendEstimate: number;
  paymentMethod: string;
  clientDate: string;
}

export async function submitSurveyResponse(
  payload: SubmitSurveyPayload
): Promise<SurveyResponse> {
  if (payload.consent !== 'Yes') {
    throw new Error('Participant consent is required to submit.');
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
    consent: 'Yes',
    name: payload.name,
    gender: payload.gender,
    ageGroup: payload.ageGroup,
    occupation: payload.occupation,
    relationshipStatus: payload.relationshipStatus,
    diningWith: payload.diningWith,
    partySize: payload.diningWith === 'Solo' ? 1 : payload.partySize,
    transportCategory: getTransportCategory(payload.transportMode),
    transportMode: payload.transportMode,
    origin: payload.origin,
    destination: payload.destination,
    currency: payload.currency,
    spendPerPax: payload.spendPerPax,
    spendEstimate: payload.spendEstimate,
    paymentMethod: payload.paymentMethod,
  });

  const docPath = `${COLLECTION_PATH}/${entry.id}`;
  try {
    await setDoc(doc(db, COLLECTION_PATH, entry.id), entry);
    return entry;
  } catch (error) {
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
