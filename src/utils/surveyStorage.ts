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
  type AgeGroupOption,
  type CurrencyCode,
  type DiningCompanionOption,
  type GenderOption,
  type OccupationOption,
  type RelationshipStatusOption,
  type SurveyResponse,
  type TransportModeOption,
} from '../types/survey';

const LOCAL_STORAGE_KEY = 'jiangnan_survey_responses_v1';
const COLLECTION_PATH = 'surveys';

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
];

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

  return {
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
      try {
        const clean = sanitizeSurveyResponse(item);
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
  orderedTakeout?: boolean;
  paymentMethod: string;
  clientDate: string;
}

export async function submitSurveyResponse(
  payload: SubmitSurveyPayload
): Promise<SurveyResponse> {
  if (payload.consent !== 'Yes') {
    throw new Error('Participant consent is required to submit.');
  }

  void migrateExistingLocalResponses();

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
    orderedTakeout: Boolean(payload.orderedTakeout),
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
