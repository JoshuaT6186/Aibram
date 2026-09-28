import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyDnc29fCjzhM2VV_8UltTTgvEQE-tCsZ6A',
  authDomain: 'aibram-9c44f.firebaseapp.com',
  projectId: 'aibram-9c44f',
  storageBucket: 'aibram-9c44f.firebasestorage.app',
  messagingSenderId: '430696585996',
  appId: '1:430696585996:web:9c0e5a5003dd1d18cdc729',
};

const app = initializeApp(firebaseConfig);

// getReactNativePersistence only exists in the native (iOS/Android) build of
// firebase/auth — calling it on web crashes with "is not a function" since
// that export genuinely isn't there. On web, the browser already persists
// sessions on its own (IndexedDB/localStorage) via plain getAuth(), so no
// extra config is needed there. On native, without this, getAuth() defaults
// to in-memory persistence — the session is gone the moment the app closes.
export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
export const db = getFirestore(app);
export default app;