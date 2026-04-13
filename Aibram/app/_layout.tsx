/**
 * app/_layout.tsx
 *
 * Root layout — auth gatekeeper.
 * Listens to Firebase auth state on every app open.
 * Redirects to /login if not authenticated, /(tabs) if authenticated.
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

export default function RootLayout() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe; // cleanup on unmount
  }, []);

  useEffect(() => {
    if (loading) return; // wait until auth state is known

    const inAuthGroup = segments[0] === '(tabs)';
    const onLoginPage = segments[0] === 'login';

    if (!user && !onLoginPage) {
      // Not logged in — send to login
      router.replace('/login');
    } else if (user && !inAuthGroup) {
      // Logged in but not in the app — send to home
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  // Show spinner while checking auth state
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050B14', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#4D96FF" size="large" />
      </View>
    );
  }

  return <Slot />;
}