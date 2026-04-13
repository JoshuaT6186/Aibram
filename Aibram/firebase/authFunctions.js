/**
 * firebase/authFunctions.js
 *
 * All Firebase auth logic.
 *
 * GOOGLE SIGN-IN SETUP (do once before testing Google login):
 * 1. Run: npx expo install expo-auth-session expo-crypto expo-web-browser
 * 2. Firebase Console → Project Settings → Add App → Android/iOS
 *    - Android: run `cd android && ./gradlew signingReport` to get SHA-1
 *    - Add SHA-1 to Firebase Console → Project Settings → Android app
 * 3. Download updated google-services.json → place in /android/app/
 * 4. iOS: download GoogleService-Info.plist → place in /ios/
 * Note: Google Sign-In requires a dev build, not Expo Go.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

// ─── SIGN UP WITH EMAIL ───────────────────────────────────────────────────────

export const signUpWithEmail = async (email, password, displayName) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;
  await updateProfile(user, { displayName });
  await setDoc(doc(db, 'users', user.uid), {
    name:        displayName,
    email:       user.email,
    xp:          0,
    streak:      0,
    lastCheckin: null,
    onboarded:   false,
    createdAt:   serverTimestamp(),
  });
  return user;
};

// ─── SIGN IN WITH EMAIL ───────────────────────────────────────────────────────

export const signInWithEmail = async (email, password) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};

// ─── GOOGLE SIGN-IN ───────────────────────────────────────────────────────────

export const signInWithGoogleCredential = async (idToken) => {
  const googleCredential = GoogleAuthProvider.credential(idToken);
  const credential = await signInWithCredential(auth, googleCredential);
  const user = credential.user;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) {
    await setDoc(doc(db, 'users', user.uid), {
      name:        user.displayName || 'Captain',
      email:       user.email,
      xp:          0,
      streak:      0,
      lastCheckin: null,
      onboarded:   false,
      createdAt:   serverTimestamp(),
    });
    return { user, isNewUser: true };
  }
  return { user, isNewUser: false };
};

// ─── ONBOARDING HELPERS ───────────────────────────────────────────────────────

export const checkOnboarded = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return false;
    return snap.data().onboarded === true;
  } catch {
    return false;
  }
};

export const markOnboarded = async (uid, displayName) => {
  await setDoc(doc(db, 'users', uid), { onboarded: true, name: displayName }, { merge: true });
};

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────

export const signOutUser = async () => {
  await signOut(auth);
};

// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────
// Deletes all Firestore data under users/{uid}/ then deletes the Auth account.
// Required for App Store approval (Apple guideline 5.1.1).

export const deleteAccount = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('No user signed in');

  const uid = user.uid;

  try {
    // Delete subcollection: users/{uid}/data/*
    const dataSnap = await getDocs(collection(db, 'users', uid, 'data'));
    const dataDeletes = dataSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(dataDeletes);

    // Delete the user profile document
    await deleteDoc(doc(db, 'users', uid));

    // Delete the Firebase Auth account
    await deleteUser(user);
  } catch (e) {
    // If deleteUser fails with requires-recent-login, caller should
    // prompt re-authentication before retrying
    throw e;
  }
};