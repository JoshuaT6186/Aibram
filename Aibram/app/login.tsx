/**
 * app/login.tsx
 *
 * Sign In / Create Account screen.
 * Matches AIBRAM space theme exactly.
 *
 * Sign Up  → creates Firebase account → sets onboarded: false → goes to /(tabs)
 *            The index.tsx detects onboarded: false and shows onboarding first.
 *
 * Sign In  → authenticates → goes to /(tabs) → onboarded check skips onboarding.
 *
 * Google   → handles both new + returning users automatically.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useFonts, Inter_400Regular, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogleCredential,
} from '../firebase/authFunctions';

// Required for expo-auth-session to close the browser after Google auth
WebBrowser.maybeCompleteAuthSession();

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:      '#050B14',
  primary: '#4D96FF',
  text:    '#E2E8F0',
  sub:     '#94A3B8',
  danger:  '#EF4565',
  line:    'rgba(255,255,255,0.08)',
};

// ─── GOOGLE CLIENT IDs ────────────────────────────────────────────────────────
// Replace these with your actual client IDs from Google Cloud Console.
// Firebase Console → Project Settings → Your Apps → Web app → OAuth 2.0 client IDs
// Or: console.cloud.google.com → APIs & Services → Credentials
const GOOGLE_WEB_CLIENT_ID    = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID    = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';

export default function LoginScreen() {
  const router = useRouter();

  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error,    setError]    = useState('');
  const [showPw,   setShowPw]   = useState(false);

  // Pulsing orb animation
  const pulse = new Animated.Value(1);
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 2000, useNativeDriver: true }),
    ])).start();
  }, []);

  let [fontsLoaded] = useFonts({ Inter_400Regular, Inter_700Bold, Inter_900Black });

  // ── Google Auth Setup ───────────────────────────────────────────────────────
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_WEB_CLIENT_ID,
    iosClientId:     GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      handleGoogleToken(id_token);
    }
  }, [googleResponse]);

  const handleGoogleToken = async (idToken: string) => {
    setGLoading(true);
    setError('');
    try {
      await signInWithGoogleCredential(idToken);
      // _layout.tsx onAuthStateChanged will automatically navigate to /(tabs)
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setGLoading(false);
    }
  };

  // ── Email Auth ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.'); return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('What should Aibram call you?'); return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.'); return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password, name.trim());
        // onAuthStateChanged in _layout.tsx handles navigation
      } else {
        await signInWithEmail(email.trim(), password);
        // onAuthStateChanged in _layout.tsx handles navigation
      }
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Error messages ──────────────────────────────────────────────────────────
  const friendlyError = (code: string): string => {
    switch (code) {
      case 'auth/email-already-in-use':    return 'That email already has an account. Try signing in.';
      case 'auth/invalid-email':           return 'That email doesn\'t look right.';
      case 'auth/wrong-password':          return 'Wrong password. Try again.';
      case 'auth/user-not-found':          return 'No account with that email. Create one?';
      case 'auth/invalid-credential':      return 'Email or password is incorrect.';
      case 'auth/too-many-requests':       return 'Too many attempts. Wait a moment and try again.';
      case 'auth/network-request-failed':  return 'Check your connection and try again.';
      default:                             return 'Something went wrong. Try again.';
    }
  };

  if (!fontsLoaded) return null;

  return (
    <LinearGradient colors={['#050B14', '#0F172A', '#1E293B']} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Orb + branding */}
          <View style={styles.header}>
            <Animated.View style={[styles.orb, { transform: [{ scale: pulse }] }]} />
            <View style={styles.orbCore} />
            <Text style={styles.appName}>AIBRAM</Text>
            <Text style={styles.tagline}>Your AI co-pilot. Lock in.</Text>
          </View>

          {/* Mode toggle */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'signin' && styles.toggleActive]}
              onPress={() => { setMode('signin'); setError(''); }}
            >
              <Text style={[styles.toggleTxt, mode === 'signin' && styles.toggleActiveTxt]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'signup' && styles.toggleActive]}
              onPress={() => { setMode('signup'); setError(''); }}
            >
              <Text style={[styles.toggleTxt, mode === 'signup' && styles.toggleActiveTxt]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Name field (sign up only) */}
          {mode === 'signup' && (
            <View style={styles.field}>
              <Ionicons name="person-outline" size={18} color={C.sub} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={C.sub}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Ionicons name="mail-outline" size={18} color={C.sub} style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={C.sub}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={18} color={C.sub} style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={C.sub}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity onPress={() => setShowPw(p => !p)} style={{ padding: 4 }}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.sub} />
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#050B14" />
              : <Text style={styles.submitTxt}>{mode === 'signup' ? 'Create Account →' : 'Sign In →'}</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerTxt}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={[styles.googleBtn, (gLoading || !googleRequest) && { opacity: 0.6 }]}
            onPress={() => promptGoogleAsync()}
            disabled={gLoading || !googleRequest}
          >
            {gLoading ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <>
                {/* Google G icon using colored dots */}
                <View style={styles.googleIcon}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: '#4285F4' }}>G</Text>
                </View>
                <Text style={styles.googleTxt}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Footer note */}
          <Text style={styles.footer}>
            {mode === 'signup'
              ? 'By creating an account you agree to our Terms of Service.'
              : 'Your data is saved to the cloud and syncs across devices.'}
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 28,
    paddingTop: 80,
    paddingBottom: 60,
  },

  // Header / branding
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  orb: {
    position: 'absolute',
    width: 90, height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(77,150,255,0.25)',
  },
  orbCore: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF',
    shadowColor: '#4D96FF', shadowRadius: 16, shadowOpacity: 0.8,
    marginBottom: 20,
  },
  appName: {
    fontFamily: 'Inter_900Black',
    fontSize: 32, color: '#FFF', letterSpacing: 4,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14, color: '#94A3B8',
  },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10,
  },
  toggleActive: {
    backgroundColor: '#4D96FF',
  },
  toggleTxt: {
    fontFamily: 'Inter_700Bold', fontSize: 14, color: '#94A3B8',
  },
  toggleActiveTxt: {
    color: '#050B14',
  },

  // Fields
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#E2E8F0',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    paddingVertical: 12,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,69,101,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,69,101,0.3)',
  },
  errorTxt: {
    color: '#EF4565',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    flex: 1,
  },

  // Submit
  submitBtn: {
    backgroundColor: '#4D96FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16, color: '#050B14',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerTxt: {
    color: '#94A3B8', fontFamily: 'Inter_400Regular',
    fontSize: 13, marginHorizontal: 12,
  },

  // Google
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
  },
  googleIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  googleTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15, color: '#E2E8F0',
  },

  // Footer
  footer: {
    color: '#94A3B8',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
  },
});