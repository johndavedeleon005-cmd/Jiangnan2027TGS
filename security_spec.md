# Security Specification — TablePulse (`surveys` & `surveyCodes` Collections)

## 1. Data Invariants
1. **Explicit Consent Invariant**: A `SurveyResponse` document in `/surveys/{surveyId}` cannot be created unless `consent == 'Yes'`.
2. **Atomic Single-Use Survey Code Invariant**:
   - Every new `SurveyResponse` must include a valid `surveyCode` (`^[A-Z0-9_\-]+$`, 4–32 chars).
   - Creation of `/surveys/{surveyId}` is only permitted when `/surveyCodes/{surveyCode}` currently has `status == 'active'` (`get()`) AND is atomically transitioned in the same Firestore transaction to `status == 'used'` with `usedByResponseId == surveyId` (`getAfter()`).
   - Transitioning `/surveyCodes/{codeId}` to `status == 'used'` is only permitted from `existing().status == 'active'` and requires the linked survey response `/surveys/{usedByResponseId}` to exist after the transaction (`existsAfter()`).
   - Once `status == 'used'`, a survey code is permanently terminal: it cannot be updated, reactivated, or deleted. Only `revoked` (unused) codes can be deleted.
3. **Path & Document ID Match**:
   - `{surveyId}` must match `^[a-zA-Z0-9_\-]+$` (4–64 chars) and equal `request.resource.data.id`.
   - `{codeId}` must match `^[A-Z0-9_\-]+$` (4–32 chars) and equal `request.resource.data.code`.
4. **Strict Key & Volumetric Boundaries**:
   - Every `SurveyResponse` document must contain all 20 required keys (`hasAll`) and only allow the permitted optional fields (`branch`, `visitFrequency`, `orderedTakeout`, `awareOnlineSoloMeal`) (`hasOnly`), with every string and numeric field bounded.
   - Every `SurveyCode` document must contain `code`, `status`, `createdAt`, `createdDate`, and `createdBy == 'Head Office'`, with optional `branch`, `note` (`<= 80` chars), `usedAt`, and `usedByResponseId` (forbidden on create).
5. **Immutability of Submitted Surveys**: Once submitted, survey responses cannot be mutated via `update` (`allow update: if false;`), preventing tampering or update-gap attacks.

## 2. The "Dirty Dozen" Payloads
1. **Missing Consent (`consent: "No"`)**: Rejected by `data.consent == 'Yes'`.
2. **Shadow / Ghost Field (`isAdmin: true`)**: Rejected by `data.keys().hasOnly(...)`.
3. **Oversized Name (`name` > 80 chars)**: Rejected by `data.name.size() <= 80`.
4. **Invalid Party Size (`partySize: 0` or `partySize: 999`)**: Rejected by `data.partySize >= 1 && data.partySize <= 50`.
5. **Invalid Date Format (`submittedDate: "18-11-2026"`)**: Rejected by `data.submittedDate.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`.
6. **Path ID Mismatch (`surveyId != data.id`)**: Rejected by `data.id == surveyId`.
7. **ID Poisoning (`surveyId` with special characters or > 64 chars)**: Rejected by `isValidId(surveyId)`.
8. **Invalid Gender Enum (`gender: "Unknown"`)**: Rejected by enum check on `data.gender`.
9. **Invalid Transport Mode (`transportMode: "Helicopter"`)**: Rejected by strict enum check on `data.transportMode` (only the 7 allowed arrival modes including `'Walked Only'`) and `data.transportCategory`.
10. **Negative Spend Estimate (`spendEstimate: -100`)**: Rejected by `data.spendEstimate >= 0`.
11. **Missing or Reused Survey Code**: Rejected by `isValidSurveyCode(data.surveyCode)` and atomic `get()` / `getAfter()` status check requiring `active -> used` transition.
12. **Code Reactivation or Used-Code Deletion**: Rejected by `existing().status == 'active'` on `update` and `existing().status == 'revoked'` on `delete`.
