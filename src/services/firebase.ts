import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  Auth,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  Firestore
} from 'firebase/firestore';
import { UserAccount, UserRole } from '../types';
import { cryptoService } from './cryptoService';

// Read Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

/**
 * Checks whether valid Firebase credentials have been provided in the environment.
 */
export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID' &&
    !firebaseConfig.apiKey.includes('YOUR_')
  );
};

// Initialize Firebase lazily/safely so app never crashes if variables are missing
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn('[LIFELINE Firebase] Initialization error:', err);
  }
}

export { auth, db };

export interface FirebaseUserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  officialId?: string;
  badgeId?: string;
  emergencyContact?: string;
  isAuthorized?: boolean;
  createdAt?: string;
}

/**
 * Authenticates user with Firebase Auth and checks Firestore for authorized status and profile details.
 */
export const loginWithFirebase = async (
  emailInput: string,
  passwordInput: string
): Promise<UserAccount> => {
  const cleanEmail = emailInput.trim().toLowerCase();

  if (!isFirebaseConfigured() || !auth || !db) {
    throw new Error(
      'Firebase is not configured. Please add your Firebase credentials to `.env.local`.'
    );
  }

  // 1. Authenticate with Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
  const user: FirebaseUser = userCredential.user;

  // 2. Query Firestore for user profile details & authorization
  let profile: Partial<FirebaseUserProfile> | null = null;

  try {
    // Check by uid first
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      profile = userDocSnap.data() as FirebaseUserProfile;
    } else {
      // Fallback check by email
      const usersQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const querySnap = await getDocs(usersQuery);
      if (!querySnap.empty) {
        profile = querySnap.docs[0].data() as FirebaseUserProfile;
      }
    }
  } catch (err) {
    console.warn('[LIFELINE Firebase] Could not read user document from Firestore:', err);
  }

  // 3. Check authorized_users collection if separate authorization table is used
  let isAuthorized = true;
  try {
    const authDocRef = doc(db, 'authorized_users', cleanEmail);
    const authDocSnap = await getDoc(authDocRef);
    if (authDocSnap.exists()) {
      const authData = authDocSnap.data();
      if (authData.isAuthorized === false) {
        isAuthorized = false;
      }
      if (!profile) {
        profile = authData as FirebaseUserProfile;
      }
    } else if (profile && profile.isAuthorized === false) {
      isAuthorized = false;
    }
  } catch (err) {
    console.warn('[LIFELINE Firebase] Authorized users check warning:', err);
  }

  // 4. Enforce authorization
  if (!isAuthorized) {
    await signOut(auth);
    throw new Error(
      `Access Denied: Email "${cleanEmail}" is not authorized. Please contact your Disaster Management administrator.`
    );
  }

  // 5. Construct verified UserAccount
  const role: UserRole = profile?.role || 'VICTIM';
  const name: string = profile?.name || user.displayName || cleanEmail.split('@')[0];
  const userId: string = profile?.officialId || profile?.phone || cleanEmail;
  const phoneId: string = profile?.badgeId || cryptoService.getOrCreateDeviceId();
  const emergencyContact: string = profile?.emergencyContact || profile?.phone || (role === 'RESCUE_TEAM' ? '+91 100 / HQ-DISPATCH' : '+91 98765 43210');

  const account: UserAccount = {
    userId,
    name,
    phoneId,
    role,
    emergencyContact
  };

  return account;
};

/**
 * Registers a new user with Firebase Auth and stores profile details in Firestore.
 */
export const registerWithFirebase = async (params: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
}): Promise<UserAccount> => {
  const cleanEmail = params.email.trim().toLowerCase();
  const role: UserRole = params.role || 'VICTIM';

  if (!isFirebaseConfigured() || !auth || !db) {
    throw new Error(
      'Firebase is not configured. Please add your Firebase credentials to `.env.local`.'
    );
  }

  // 1. Create user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
  const user = userCredential.user;

  // 2. Store user profile in Firestore
  const userProfile: FirebaseUserProfile = {
    uid: user.uid,
    name: params.fullName.trim(),
    email: cleanEmail,
    phone: params.phone.trim(),
    role,
    isAuthorized: true, // Authorized upon registration
    emergencyContact: params.phone.trim(),
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'users', user.uid), userProfile);
  } catch (err) {
    console.error('[LIFELINE Firebase] Error storing user profile in Firestore:', err);
  }

  const account: UserAccount = {
    userId: cleanEmail,
    name: params.fullName.trim(),
    phoneId: cryptoService.getOrCreateDeviceId(),
    role,
    emergencyContact: params.phone.trim()
  };

  return account;
};

/**
 * Signs the current user out of Firebase Auth.
 */
export const logoutFromFirebase = async (): Promise<void> => {
  if (auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[LIFELINE Firebase] Sign out error:', err);
    }
  }
};
