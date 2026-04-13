import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDnc29fCjzhM2VV_8UltTTgvEQE-tCsZ6A',
  authDomain: 'aibram-9c44f.firebaseapp.com',
  projectId: 'aibram-9c44f',
  storageBucket: 'aibram-9c44f.firebasestorage.app',
  messagingSenderId: '430696585996',
  appId: '1:430696585996:web:9c0e5a5003dd1d18cdc729',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;