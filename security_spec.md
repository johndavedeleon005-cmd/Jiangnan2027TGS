# Security Specification — TablePulse (`surveys`, `surveyCodes`, & `branchCodeLimits` Collections)

## 1. Data Invariants
1. **Explicit Consent Invariant**: A `SurveyResponse` document in `/surveys/{surveyId}` cannot be created unless `consent == 'Yes'`.
2. **Atomic Single-Use Survey Code Invariant**:
   - Every new `SurveyResponse` must include a valid `surveyCode` (`^[A-Z0-9_\-]+$`, 4–32 chars).
   - Creation of `/surveys/{surveyId}` is only permitted when `/surveyCodes/{surveyCode}` currently has `status == 'active'` (`get()`) AND is atomically transitioned in the same Firestore transaction to `status == 'used'` with `usedByResponseId == surveyId` (`getAfter()`).
   - Transitioning `/surveyCodes/{codeId}` to `status == 'used'` is only permitted from `existing().status == 'active'`, requires the linked survey response `/surveys/{usedByResponseId}` to exist after the transaction (`existsAfter()`), and if `usedAtBranch` is recorded, requires it to match `getAfter(/surveys/{usedByResponseId}).data.branch`.
   - Once `status == 'used'`, a survey code is permanently terminal: it cannot be updated, reactivated, or deleted. Only `revoked` (unused) codes can be deleted.
3. **Atomic Branch Code Generation Quota Invariant**:
   - Survey codes may be created by `'Head Office'` (unlimited) or by a valid Jiang Nan branch (`createdBy == branch`).
   - When a branch creates one or more survey codes, its `/branchCodeLimits/{branchSlug}` document MUST exist with `maxCodes > 0`, `generatedCount < maxCodes`, and MUST atomically increment `generatedCount` in the same Firestore transaction (`getAfter().data.generatedCount > get().data.generatedCount && getAfter().data.generatedCount <= get().data.maxCodes`).
   - Branch dashboards cannot revoke or delete survey codes (UI and dashboard actions restrict revoke/delete exclusively to Head Office).
4. **Path & Document ID Match**:
   - `{surveyId}` must match `^[a-zA-Z0-9_\-]+$` (4–64 chars) and equal `request.resource.data.id`.
   - `{codeId}` must match `^[A-Z0-9_\-]+$` (4–32 chars) and equal `request.resource.data.code`.
   - `{branchId}` must match `^[A-Z0-9_]+$` (4–40 chars) and equal `request.resource.data.branch.replace(' ', '_')`.
5. **Immutability & Volumetric Boundaries**:
   - All strings, enums, and numbers are strictly bounded across all three collections.
   - Submitted surveys are immutable (`allow update: if false;`), and branch limit records cannot be deleted (`allow delete: if false;`).

## 2. The "Dirty Dozen" Payloads
1. **Missing Consent (`consent: "No"`)**: Rejected by `data.consent == 'Yes'`.
2. **Shadow / Ghost Field (`isAdmin: true`)**: Rejected by `data.keys().hasOnly(...)`.
3. **Oversized Name (`name` > 80 chars)**: Rejected by `data.name.size() <= 80`.
4. **Invalid Party Size (`partySize: 0` or `partySize: 999`)**: Rejected by `data.partySize >= 1 && data.partySize <= 50`.
5. **Invalid Date Format (`submittedDate: "18-11-2026"`)**: Rejected by `data.submittedDate.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`.
6. **Path ID Mismatch (`surveyId != data.id` or `branchId != data.branch.replace(' ', '_')`)**: Rejected by equality check.
7. **ID Poisoning (`surveyId` or `branchId` with invalid chars)**: Rejected by `isValidId()` / `isValidBranchLimitId()`.
8. **Invalid Gender / Transport / Branch Enum**: Rejected by strict allowlist checks.
9. **Negative Spend Estimate (`spendEstimate: -100`)**: Rejected by `data.spendEstimate >= 0`.
10. **Missing or Reused Survey Code**: Rejected by `isValidSurveyCode()` and atomic `active -> used` transaction check.
11. **Branch Exceeding Head Office Code Limit or Forging Another Branch's Code**: Rejected by `incoming().branch == incoming().createdBy` and atomic `get()` / `getAfter()` quota checks on `/branchCodeLimits/{branchId}`.
12. **Code Reactivation or Used-Code Deletion**: Rejected by `existing().status == 'active'` on `update` and `existing().status == 'revoked'` on `delete`.
