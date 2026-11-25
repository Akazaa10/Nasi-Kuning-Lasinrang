/**
 * Phase 0 Payload-First Security TDD Specification for Nasi Kuning Lasinrang Firestore Rules.
 * Verifies all "Dirty Dozen" adversarial payloads targeting Identity, Integrity, PII Isolation,
 * Resource Exhaustion, Audit Immutability, and State Shortcutting.
 *
 * Run against Firebase Emulator Suite (`firebase emulators:exec`) when executing locally.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on /store/main',
    operation: 'update',
    path: '/store/main',
    auth: { uid: 'admin-1', email: 'ardiansyahardhy411@gmail.com', email_verified: true },
    payload: {
      brandName: 'NASI KUNING LASINRANG',
      locationAddress: 'Pinrang',
      isOpenLive: true,
      whatsappNumber: '6282363953662',
      ewalletNumber: '08215089754',
      isSuperAdmin: true, // Ghost field
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidStoreSettings() data.keys().hasOnly([...])',
  },
  {
    id: 2,
    name: 'Email Spoofing (email_verified: false) on /store/main',
    operation: 'update',
    path: '/store/main',
    auth: { uid: 'spoof-1', email: 'ardiansyahardhy411@gmail.com', email_verified: false },
    payload: {
      brandName: 'Hacked Store',
      locationAddress: 'Pinrang',
      isOpenLive: false,
      whatsappNumber: '628111111111',
      ewalletNumber: '08111111111',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedUser() requires request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Non-Admin Customer Hijacking Storefront QRIS',
    operation: 'update',
    path: '/store/main',
    auth: { uid: 'cust-1', email: 'pelanggan@gmail.com', email_verified: true },
    payload: {
      brandName: 'NASI KUNING LASINRANG',
      locationAddress: 'Pinrang',
      isOpenLive: true,
      whatsappNumber: '628999999999',
      ewalletNumber: '08999999999',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isAdmin() gate on /store/main create & update',
  },
  {
    id: 4,
    name: 'Resource Poisoning via Oversized/Invalid Menu ID',
    operation: 'create',
    path: `/menuItems/${'a'.repeat(160)}`,
    auth: { uid: 'admin-1', email: 'ardiansyahardhy411@gmail.com', email_verified: true },
    payload: {
      id: 'a'.repeat(160),
      name: 'Poison',
      category: 'reguler',
      basePrice: 10000,
      description: 'Test',
      sidesIncluded: ['Nasi'],
      imageUrl: 'https://example.com/a.jpg',
      isAvailable: true,
      spiceLevel: 'Gurih',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(itemId) enforces size <= 128 and regex ^[a-zA-Z0-9_-]+$',
  },
  {
    id: 5,
    name: 'Value Poisoning (Oversized imageUrl / Invalid Type) on Menu Item',
    operation: 'update',
    path: '/menuItems/nasi-kuning-ayam-bakar',
    auth: { uid: 'admin-1', email: 'ardiansyahardhy411@gmail.com', email_verified: true },
    payload: {
      id: 'nasi-kuning-ayam-bakar',
      name: 'Ayam Bakar',
      category: 'reguler',
      basePrice: '10000', // Invalid type (string instead of number)
      description: 'Test',
      sidesIncluded: ['Nasi'],
      imageUrl: 'x'.repeat(400000), // Exceeds 350000 limit
      isAvailable: true,
      spiceLevel: 'Gurih',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMenuItem() enforces basePrice is number && imageUrl.size() <= 350000',
  },
  {
    id: 6,
    name: 'PII Blanket Leak Attempt on /ownerPrivate/settings',
    operation: 'get',
    path: '/ownerPrivate/settings',
    auth: { uid: 'cust-1', email: 'pelanggan@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: '/ownerPrivate/{docId} allows get/create/update strictly to isAdmin()',
  },
  {
    id: 7,
    name: 'Audit Log Tampering / Deletion Attempt',
    operation: 'delete',
    path: '/ownerAuditLogs/log-1',
    auth: { uid: 'admin-1', email: 'ardiansyahardhy411@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: '/ownerAuditLogs/{logId} enforces allow update, delete: if false',
  },
  {
    id: 8,
    name: 'Audit Log Identity Spoofing (Wrong actorUid)',
    operation: 'create',
    path: '/ownerAuditLogs/log-2',
    auth: { uid: 'admin-1', email: 'ardiansyahardhy411@gmail.com', email_verified: true },
    payload: {
      id: 'log-2',
      action: 'migration',
      actorUid: 'other-admin-uid',
      actorEmail: 'ardiansyahardhy411@gmail.com',
      storeSaved: true,
      menuCount: 12,
      orderCount: 0,
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidOwnerAuditLog() requires data.actorUid == request.auth.uid',
  },
  {
    id: 9,
    name: 'Cross-User PII Read on /users/{userId}/locations/{locationId}',
    operation: 'get',
    path: '/users/userA/locations/loc1',
    auth: { uid: 'userB', email: 'userb@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId) || isAdmin()',
  },
  {
    id: 10,
    name: 'Order Identity Spoofing (Creating order under another userId)',
    operation: 'create',
    path: '/orders/ORD-SPOOF',
    auth: { uid: 'userA', email: 'usera@gmail.com', email_verified: true },
    payload: {
      id: 'ORD-SPOOF',
      userId: 'userB',
      customerName: 'User A',
      customerPhone: '08123456789',
      fulfillment: 'pickup',
      paymentMethod: 'qris',
      itemsSummary: [{ name: 'Nasi Kuning', quantity: 1 }],
      foodSubtotal: 10000,
      status: 'Menunggu Konfirmasi',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().userId == request.auth.uid',
  },
  {
    id: 11,
    name: 'Order State Shortcutting & Subtotal Tampering by Customer',
    operation: 'create',
    path: '/orders/ORD-SHORTCUT',
    auth: { uid: 'userA', email: 'usera@gmail.com', email_verified: true },
    payload: {
      id: 'ORD-SHORTCUT',
      userId: 'userA',
      customerName: 'User A',
      customerPhone: '08123456789',
      fulfillment: 'pickup',
      paymentMethod: 'qris',
      itemsSummary: [{ name: 'Nasi Kuning', quantity: 1 }],
      foodSubtotal: 10000,
      status: 'Selesai', // Attempted shortcut
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: "Non-admin create enforces incoming().status == 'Menunggu Konfirmasi'",
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Role Escalation on /admins/{uid}',
    operation: 'create',
    path: '/admins/attacker-uid',
    auth: { uid: 'attacker-uid', email: 'attacker@gmail.com', email_verified: true },
    payload: {
      uid: 'attacker-uid',
      role: 'admin',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: '/admins/{uid} strictly enforces allow list, write: if false',
  },
];
