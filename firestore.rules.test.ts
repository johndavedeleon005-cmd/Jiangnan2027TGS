/**
 * Security Rules Verification Suite for /surveys/{surveyId}
 * Verifies all Dirty Dozen payloads are rejected by the SurveyResponse blueprint.
 */

export interface DirtyDozenCase {
  name: string;
  docId: string;
  payload: Record<string, unknown>;
  expectAllowed: boolean;
}

const VALID_PAYLOAD = {
  id: 'SRV-TEST-0001',
  submittedAt: '2026-11-18T01:40:00.000Z',
  submittedDate: '2026-11-18',
  branch: 'BANAWE',
  consent: 'Yes',
  name: 'Anonymous',
  gender: 'Female',
  ageGroup: '25–34',
  occupation: 'Employed',
  relationshipStatus: 'Single',
  diningWith: 'Friends',
  partySize: 3,
  transportCategory: 'Private',
  transportMode: 'Private Car',
  origin: 'Office',
  destination: 'Home',
  currency: 'PHP',
  spendPerPax: '699-799 Hotpot Only',
  spendEstimate: 749,
  orderedTakeout: true,
  paymentMethod: 'E-Wallet (GCash / Maya)',
};

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  { name: 'Valid survey submission', docId: 'SRV-TEST-0001', payload: VALID_PAYLOAD, expectAllowed: true },
  { name: '1. Declined consent', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, consent: 'No' }, expectAllowed: false },
  { name: '2. Ghost field injection', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, isAdmin: true }, expectAllowed: false },
  { name: '3. Oversized name', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, name: 'A'.repeat(81) }, expectAllowed: false },
  { name: '4. Party size out of range', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, partySize: 99 }, expectAllowed: false },
  { name: '5. Malformed submittedDate', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, submittedDate: '2026/11/18' }, expectAllowed: false },
  { name: '6. Mismatched docId and payload.id', docId: 'SRV-OTHER-9999', payload: VALID_PAYLOAD, expectAllowed: false },
  { name: '7. Invalid characters in docId', docId: 'SRV$BAD!ID', payload: { ...VALID_PAYLOAD, id: 'SRV$BAD!ID' }, expectAllowed: false },
  { name: '8. Invalid gender enum', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, gender: 'Other' }, expectAllowed: false },
  { name: '9. Invalid transportMode enum', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, transportMode: 'Subway' }, expectAllowed: false },
  { name: '10. Negative spendEstimate', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, spendEstimate: -5 }, expectAllowed: false },
  { name: '11. Invalid branch name', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, branch: 'INVALID BRANCH' }, expectAllowed: false },
  { name: '12. Empty paymentMethod string', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, paymentMethod: '' }, expectAllowed: false },
];
