# Security Specification — TablePulse (`surveys` Collection)

## 1. Data Invariants
1. **Explicit Consent Invariant**: A `SurveyResponse` document in `/surveys/{surveyId}` cannot be created unless `consent == 'Yes'`.
2. **Path & Document ID Match**: The document ID `{surveyId}` must match `^[a-zA-Z0-9_\-]+$`, have length `<= 128`, and equal `request.resource.data.id`.
3. **Strict Key & Volumetric Boundaries**: Every `SurveyResponse` document must contain the 19 required keys defined in `firebase-blueprint.json` (`hasAll`) and only allow optional `branch` (must match one of the 21 Jiang Nan branches, `<= 40` chars), `visitFrequency` (`'First Time'`, `'2nd Time'`, or `'3 or More Times'`, `<= 24` chars), `orderedTakeout` (`bool`), and `awareOnlineSoloMeal` (`'Yes'` or `'No'`, `<= 3` chars) (`hasOnly`), with every string and numeric field bounded (`name <= 80`, `origin <= 80`, `destination <= 80`, `spendPerPax <= 80`, `paymentMethod <= 60`, `partySize >= 1 && partySize <= 50`, `spendEstimate >= 0 && spendEstimate <= 1000000`).
4. **Immutability of Submitted Surveys**: Once submitted, survey responses cannot be mutated via `update` (`allow update: if false;`), preventing tampering or update-gap attacks.

## 2. The "Dirty Dozen" Payloads
1. **Missing Consent (`consent: "No"`)**: Rejected by `data.consent == 'Yes'`.
2. **Shadow / Ghost Field (`isAdmin: true`)**: Rejected by `data.keys().hasOnly(...)`.
3. **Oversized Name (`name` > 80 chars)**: Rejected by `data.name.size() <= 80`.
4. **Invalid Party Size (`partySize: 0` or `partySize: 999`)**: Rejected by `data.partySize >= 1 && data.partySize <= 50`.
5. **Invalid Date Format (`submittedDate: "18-11-2026"`)**: Rejected by `data.submittedDate.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`.
6. **Path ID Mismatch (`surveyId != data.id`)**: Rejected by `data.id == surveyId`.
7. **ID Poisoning (`surveyId` with special characters or > 128 chars)**: Rejected by `isValidId(surveyId)`.
8. **Invalid Gender Enum (`gender: "Unknown"`)**: Rejected by enum check on `data.gender`.
9. **Invalid Transport Mode (`transportMode: "Helicopter"`)**: Rejected by strict enum check on `data.transportMode` (only the 7 allowed arrival modes including `'Walked Only'`) and `data.transportCategory` (`'Private'`, `'Public'`, `'On Foot'`).
10. **Negative Spend Estimate (`spendEstimate: -100`)**: Rejected by `data.spendEstimate >= 0`.
11. **Invalid Branch (`branch: "UNKNOWN BRANCH"`)**: Rejected by 21-branch enum check on `data.branch`.
12. **Tampering via Update (`update` existing survey)**: Rejected by `allow update: if false;`.
