import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  initializeFirestore,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const OWNER_ADMIN_EMAILS = ['ardiansyahardhy411@gmail.com'];
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const FIREBASE_CONSOLE_DATA_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data`;
export const FIREBASE_CONSOLE_RULES_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/rules`;
export const FIREBASE_CONSOLE_AUTH_DOMAINS_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;

const app = initializeApp(firebaseConfig);
setLogLevel('silent');
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testFirestoreConnection();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function checkFirestoreQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes('Quota exceeded') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Free daily read units per project')
  ) {
    window.dispatchEvent(
      new CustomEvent('firestore-quota-exceeded', {
        detail: {
          message: msg,
          upgradeUrl: `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`,
        },
      })
    );
    return true;
  }
  return false;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  checkFirestoreQuotaError(error);
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

export function isOwnerAdminUser(user: User | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  const normalized = user.email.toLowerCase().trim();
  return OWNER_ADMIN_EMAILS.some((email) => email.toLowerCase() === normalized);
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
}

export function formatFirebaseAuthError(error: unknown): {
  code: string;
  message: string;
  isUnauthorizedDomain: boolean;
  isCancelled: boolean;
} {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      isUnauthorizedDomain: true,
      isCancelled: false,
      message: `Domain website (${host || 'domain saat ini'}) belum terdaftar di Authorized Domains Firebase Console. Tambahkan domain ini di Authentication → Settings → Authorized domains atau hubungkan proyek Firebase milik Anda.`,
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      code,
      isUnauthorizedDomain: false,
      isCancelled: false,
      message:
        'Popup Login Google diblokir oleh browser HP. Izinkan pop-up untuk website ini lalu tekan tombol Login lagi.',
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      isUnauthorizedDomain: false,
      isCancelled: true,
      message:
        'Jendela Login Google ditutup sebelum selesai. Pastikan pop-up diizinkan lalu coba lagi.',
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      isUnauthorizedDomain: false,
      isCancelled: false,
      message:
        'Login Google (Google Sign-In) belum diaktifkan di Firebase Console proyek ini.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      code,
      isUnauthorizedDomain: false,
      isCancelled: false,
      message:
        'Koneksi internet terganggu saat menghubungi server Google. Periksa jaringan lalu coba lagi.',
    };
  }
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  return {
    code: code || 'auth/unknown',
    isUnauthorizedDomain: false,
    isCancelled: false,
    message: rawMsg
      ? `Login Google gagal (${code || 'error'}): ${rawMsg}`
      : 'Login Google gagal diproses. Coba buka di browser Chrome penuh lalu coba lagi.',
  };
}
