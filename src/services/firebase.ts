import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
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
    firebaseConfig.apiKey.trim() !== '' &&
    firebaseConfig.projectId.trim() !== '' &&
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
 * Formats Firebase error codes into clear, user-friendly security messages.
 */
export const formatFirebaseAuthError = (err: any): string => {
  if (!err) return 'Authentication failed. Please try again.';
  const code = err.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Access is temporarily disabled. Please try again later.';
    case 'auth/user-disabled':
      return 'This user account has been disabled by an administrator.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    default:
      return err.message || 'Authentication error. Please verify your details.';
  }
};

/**
 * Reads user profile from Firestore or constructs from FirebaseUser.
 */
export const fetchUserAccountFromFirebase = async (user: FirebaseUser): Promise<UserAccount> => {
  const cleanEmail = (user.email || '').trim().toLowerCase();
  let profile: Partial<FirebaseUserProfile> | null = null;

  if (db) {
    try {
      // 1. Check by uid in 'users' collection
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
  }

  const role: UserRole = profile?.role || 'VICTIM';
  const name: string = profile?.name || user.displayName || cleanEmail.split('@')[0] || 'Lifeline User';
  const userId: string = profile?.officialId || profile?.phone || cleanEmail || user.uid;
  const phoneId: string = profile?.badgeId || cryptoService.getOrCreateDeviceId();
  const emergencyContact: string =
    profile?.emergencyContact ||
    profile?.phone ||
    (role === 'RESCUE_TEAM' ? '+91 100 / HQ-DISPATCH' : '+91 98765 43210');

  return {
    userId,
    name,
    phoneId,
    role,
    emergencyContact
  };
};

/**
 * Authenticates user with Firebase Auth and checks Firestore for authorized status and profile details.
 * NEVER allows login on wrong password or missing Firebase user.
 */
export const loginWithFirebase = async (
  emailInput: string,
  passwordInput: string
): Promise<UserAccount> => {
  const cleanEmail = emailInput.trim().toLowerCase();

  if (!isFirebaseConfigured() || !auth) {
    throw new Error(
      'Firebase Authentication is not configured. Please add your Firebase credentials to `.env.local`.'
    );
  }

  // 1. Authenticate directly with Firebase Auth — Firebase verifies the password
  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
  const user: FirebaseUser = userCredential.user;

  // 2. Query Firestore for authorized status if db is available
  if (db) {
    let isAuthorized = true;
    try {
      const authDocRef = doc(db, 'authorized_users', cleanEmail);
      const authDocSnap = await getDoc(authDocRef);
      if (authDocSnap.exists()) {
        const authData = authDocSnap.data();
        if (authData.isAuthorized === false) {
          isAuthorized = false;
        }
      } else {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data() as FirebaseUserProfile;
          if (uData.isAuthorized === false) {
            isAuthorized = false;
          }
        }
      }
    } catch (err) {
      console.warn('[LIFELINE Firebase] Authorized users check warning:', err);
    }

    if (!isAuthorized) {
      await signOut(auth);
      throw new Error(
        `Access Denied: Email "${cleanEmail}" is not authorized. Please contact your Disaster Management administrator.`
      );
    }
  }

  // 3. Construct verified UserAccount
  return await fetchUserAccountFromFirebase(user);
};

/**
 * Registers a new user with Firebase Auth and stores profile details in Firestore.
 * Passwords are sent ONLY to Firebase Authentication and NEVER stored anywhere in plain text.
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

  if (!isFirebaseConfigured() || !auth) {
    throw new Error(
      'Firebase Authentication is not configured. Please add your Firebase credentials to `.env.local`.'
    );
  }

  if (params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // 1. Create user with Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
  const user = userCredential.user;

  // 2. Store user profile metadata in Firestore (WITHOUT the password)
  if (db) {
    const userProfile: FirebaseUserProfile = {
      uid: user.uid,
      name: params.fullName.trim(),
      email: cleanEmail,
      phone: params.phone.trim(),
      role,
      isAuthorized: true,
      emergencyContact: params.phone.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', user.uid), userProfile);
    } catch (err) {
      console.error('[LIFELINE Firebase] Error storing user profile in Firestore:', err);
    }
  }

  return {
    userId: cleanEmail,
    name: params.fullName.trim(),
    phoneId: cryptoService.getOrCreateDeviceId(),
    role,
    emergencyContact: params.phone.trim()
  };
};

/**
 * Sends a real Firebase password reset email.
 */
export const resetPasswordWithFirebase = async (emailInput: string): Promise<void> => {
  const cleanEmail = emailInput.trim().toLowerCase();

  if (!isFirebaseConfigured() || !auth) {
    throw new Error(
      'Firebase Authentication is not configured. Please add your Firebase credentials to `.env.local`.'
    );
  }

  await sendPasswordResetEmail(auth, cleanEmail);
};

/**
 * Subscribes to Firebase Authentication state changes.
 */
export const subscribeToAuthState = (
  callback: (user: FirebaseUser | null) => void
): (() => void) => {
  if (!isFirebaseConfigured() || !auth) {
    // Return dummy unsubscribe if Firebase is not active
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
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
