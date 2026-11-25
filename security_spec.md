# Security Specification — Nasi Kuning Lasinrang Firestore Vault

## 1. Data Invariants
1. **Public vs Private Isolation**:
   - Only non-PII storefront data (`/store/main` and `/menuItems/{itemId}`) is publicly readable.
   - `/ownerPrivate/{docId}` (containing customer WA Quick Reply drafts and owner metadata) and `/ownerAuditLogs/{logId}` are **strictly Admin-only** (`read`/`write`).
   - `/users/{userId}/locations/{locationId}` and `/orders/{orderId}` contain PII (phone numbers, addresses, GPS pins) and are strictly isolated to the owning `request.auth.uid` or a verified Admin.
2. **Verified Admin Authority**:
   - Every write to `/store/main`, `/menuItems/*`, `/ownerPrivate/settings`, and `/ownerAuditLogs/*` requires `isSignedIn() && isVerifiedUser() && isAdmin()`.
   - Unverified emails (`email_verified == false`) are NEVER granted admin or standard write privileges.
   - `/store/main` and `/ownerPrivate/settings` cannot be deleted (`allow delete: if false`).
   - `/ownerAuditLogs/*` is append-only immutable (`allow update, delete: if false`).
3. **Volumetric & Schema Integrity**:
   - Every entity enforces `hasAll` + `hasOnly` allowlists, strict types, mandatory `.size()` checks on every string and array, `isValidId()` on single-document IDs, and server-verified `request.time` timestamps.
4. **Secure List Queries (Zero O(n) Lookups)**:
   - No `allow list` block calls `get()` or `exists()`. List rules evaluate `resource.data.userId == request.auth.uid` or claim-only `isBootstrappedAdmin()`.
5. **Immutability & Terminal State Protection**:
   - `createdAt`, `userId`, and document `id` are immutable after creation.
   - Customer order creation is restricted to `status == 'Menunggu Konfirmasi'`; only verified Admins can update order status (`affectedKeys().hasOnly(['status', 'updatedAt'])`) or migrate historical orders.

## 2. The "Dirty Dozen" Payloads (All MUST return `PERMISSION_DENIED`)
1. **Shadow Field Injection on `/store/main`**: Admin writes valid `StoreSettings` plus ghost field `isSuperAdmin: true`.
2. **Email Spoofing on `/store/main`**: Attacker authenticates with `email: 'ardiansyahardhy411@gmail.com'` but `email_verified: false`.
3. **Non-Admin Storefront Hijack**: Verified non-admin customer attempts to update `/store/main` `whatsappNumber` or `qrisImageUrl`.
4. **Resource Poisoning via Oversized Menu ID**: Admin attempts to create `/menuItems/<200-char-junk-id>`.
5. **Value Poisoning on Menu Image**: Admin attempts to write `imageUrl` exceeding `350000` chars or non-string `basePrice: "free"`.
6. **PII Leak on `/ownerPrivate/settings`**: Authenticated non-admin customer attempts `get` or `list` on `/ownerPrivate/settings`.
7. **Audit Log Tampering**: Even verified Admin attempts `update` or `delete` on `/ownerAuditLogs/{logId}`.
8. **Audit Log Identity Spoofing**: Admin attempts to create `/ownerAuditLogs/{logId}` with `actorUid: "someone-else"`.
9. **Cross-User PII Read on Saved Locations**: User B attempts `get` on `/users/userA/locations/loc1`.
10. **Order Identity Spoofing**: User A attempts to create `/orders/ORD-1` with `userId: "userB"`.
11. **Order State Shortcutting**: Customer attempts to create `/orders/ORD-2` directly with `status: "Selesai"`, or update an existing order's `foodSubtotal`.
12. **Timestamp Forgery & Admin Escalation**: Customer attempts to write `/admins/{uid}` to self-assign admin role, or create an order with client-forged `createdAt` instead of `request.time`.
