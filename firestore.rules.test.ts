/**
 * Security Rules Verification Suite for /surveys/{surveyId} & /surveyCodes/{codeId}
 * Verifies all Dirty Dozen payloads are rejected by the blueprint and single-use invariants.
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
  surveyCode: 'JN-TEST-1001',
  branch: 'BANAWE',
  consent: 'Yes',
  name: 'Anonymous',
  gender: 'Female',
  ageGroup: '25–34',
  occupation: 'Employed',
  relationshipStatus: 'Single',
  diningWith: 'Friends',
  visitFrequency: 'First Time',
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
  awareOnlineSoloMeal: 'Yes',
};

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  { name: 'Valid survey submission (with active single-use code)', docId: 'SRV-TEST-0001', payload: VALID_PAYLOAD, expectAllowed: true },
  {
    name: 'Valid Walked Only submission',
    docId: 'SRV-TEST-0002',
    payload: {
      ...VALID_PAYLOAD,
      id: 'SRV-TEST-0002',
      surveyCode: 'JN-TEST-1002',
      transportCategory: 'On Foot',
      transportMode: 'Walked Only',
    },
    expectAllowed: true,
  },
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
  { name: '13. Invalid awareOnlineSoloMeal enum', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, awareOnlineSoloMeal: 'Maybe' }, expectAllowed: false },
  { name: '14. Invalid visitFrequency enum', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, visitFrequency: '10th Time' }, expectAllowed: false },
  { name: '15. Missing surveyCode', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, surveyCode: '' }, expectAllowed: false },
  { name: '16. Invalid lowercase/symbols in surveyCode', docId: 'SRV-TEST-0001', payload: { ...VALID_PAYLOAD, surveyCode: 'bad code!' }, expectAllowed: false },
];
