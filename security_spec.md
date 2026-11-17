# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied for both reads and writes (`match /{document=**} { allow read, write: if false; }`).
2. **Non-PII Broadcast Isolation**: `/schools/{schoolId}` and `/schools/{schoolId}/schedules/{scheduleId}` contain NO PII (no emails, phone numbers, addresses). Public broadcast read is restricted strictly to documents where `isPublicBroadcast == true` and `schoolId == 'sd-quran-unggulan'`.
3. **Verified Admin-Only Mutations**: All `create`, `update`, and `delete` operations require `request.auth != null && request.auth.token.email_verified == true` and verified admin status (`request.auth.token.email == 'bangyub003@gmail.com'` or an existing `/admins/{uid}` record).
4. **Master Gate Relational Integrity**: Subcollection `/schools/{schoolId}/schedules/{scheduleId}` validates parent `/schools/{schoolId}` existence via `exists()` on create/update/delete, and matches `data.schoolId == schoolId`. Never invokes `get()`/`exists()` inside `allow list`.
5. **Temporal Integrity & Immortality**: `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt`, `ownerId`, and `schoolId` are immutable on updates.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Write to SchoolConfig**: `setDoc('/schools/sd-quran-unggulan', ...)` with `request.auth == null` -> DENIED.
2. **Unverified Email Spoofing**: `request.auth = { uid: 'x', token: { email: 'bangyub003@gmail.com', email_verified: false } }` -> DENIED.
3. **Non-Admin User Write**: `request.auth = { uid: 'stranger', token: { email: 'stranger@gmail.com', email_verified: true } }` -> DENIED.
4. **Self-Assigned Admin Escalation**: Authenticated stranger attempts `setDoc('/admins/stranger', { uid: 'stranger' })` -> DENIED.
5. **Shadow / Ghost Field Injection**: Admin sends `{ ...validSchool, isSuperRoot: true }` -> DENIED via `keys().hasOnly(...)`.
6. **Shadow Field on Update**: Admin calls `updateDoc` changing a disallowed key `createdAt` or `ownerId` -> DENIED via `affectedKeys().hasOnly(...)` + immutability checks.
7. **Orphaned Schedule Without Parent School**: Admin creates `/schools/nonexistent/schedules/s1` -> DENIED via parent `exists()` check.
8. **ID Poisoning**: Admin creates `/schools/../../evil` or 200-char ID -> DENIED via `isValidId()`.
9. **Client Timestamp Forgery**: Admin creates schedule with `createdAt: new Date(0)` instead of `serverTimestamp()` -> DENIED via `createdAt == request.time`.
10. **Invalid Category / Value Poisoning**: Admin sends `{ category: 'invalid_cat', days: ['hack'], volume: 99 }` -> DENIED via `isValidSchedule()`.
11. **Oversized String Exhaustion**: Admin sends `speechText` > 2000 chars or `label` > 160 chars -> DENIED via `.size()` bounds.
12. **Reading Private/Unmatched School Docs Without Auth**: Unauthenticated client requests `list` on `/schools` or `/admins` -> DENIED.
