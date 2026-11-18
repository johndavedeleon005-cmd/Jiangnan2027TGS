import {
  getLocalDateString,
  getTransportCategory,
  type CurrencyCode,
  type DiningCompanionOption,
  type SurveyResponse,
  type TransportModeOption,
} from '../types/survey';

const LOCAL_STORAGE_KEY = 'jiangnan_survey_responses_v1';

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

function apiUrl(subpath: string): string {
  return `${getBaseAppUrl()}${subpath.replace(/^\//, '')}`;
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
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

function isJsonApiResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

export async function loadSurveyResponses(): Promise<SurveyResponse[]> {
  try {
    const res = await fetch(apiUrl('api/surveys'), { cache: 'no-store' });
    if (res.ok && isJsonApiResponse(res)) {
      const data = (await res.json()) as { responses: SurveyResponse[] };
      return Array.isArray(data.responses) ? data.responses : [];
    }
    if (res.status === 404 || res.status === 405 || !isJsonApiResponse(res)) {
      return readLocalResponses();
    }
    throw new Error('Failed to load survey responses.');
  } catch {
    return readLocalResponses();
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

  let validationError: Error | null = null;
  try {
    const res = await fetch(apiUrl('api/surveys'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok && isJsonApiResponse(res)) {
      const data = (await res.json()) as { response: SurveyResponse };
      return data.response;
    }

    if (
      res.status >= 400 &&
      res.status < 500 &&
      res.status !== 404 &&
      res.status !== 405 &&
      isJsonApiResponse(res)
    ) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      validationError = new Error(
        errData.error || 'Could not save your survey response.'
      );
    }
  } catch {
    // Fall through to local persistence on static hosting
  }

  if (validationError) {
    throw validationError;
  }

  const now = new Date();
  const entry: SurveyResponse = {
    id: `SRV-${now.getTime().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`,
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
  };

  const existing = readLocalResponses();
  writeLocalResponses([entry, ...existing]);
  return entry;
}

export async function deleteSurveyResponseById(id: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`api/surveys/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    if (res.ok) return true;
    if (res.status !== 404 && res.status !== 405) return false;
  } catch {
    // Fall back to local storage
  }
  const next = readLocalResponses().filter((item) => item.id !== id);
  writeLocalResponses(next);
  return true;
}

export async function clearAllSurveyResponses(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('api/surveys'), { method: 'DELETE' });
    if (res.ok) return true;
    if (res.status !== 404 && res.status !== 405) return false;
  } catch {
    // Fall back to local storage
  }
  writeLocalResponses([]);
  return true;
}
