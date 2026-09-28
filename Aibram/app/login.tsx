/**
 * app/login.tsx
 *
 * Sign In / Create Account screen.
 * Visuals restyled to match Aibram's real identity (nebula background,
 * violet-to-gold gradient, the actual outline-face mark) — all auth logic
 * below is untouched from the working version: same signUpWithEmail /
 * signInWithEmail / signInWithGoogleCredential calls, same validation,
 * same error handling.
 *
 * Google Sign-In: real client IDs are now wired in (previously placeholders
 * that threw "invalid_client"). Android is not shipping yet, so no
 * androidClientId is passed — omitted rather than left as a fake value.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Defs, LinearGradient as SvgGradient, RadialGradient, Stop } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useFonts, Inter_400Regular, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogleCredential,
} from '../firebase/authFunctions';

WebBrowser.maybeCompleteAuthSession();

// ─── THEME — Aibram's real palette, matching app/(tabs)/index.tsx's C object ──
const C = {
  void:    '#05060f',
  deep:    '#0a0b1a',
  nebula:  '#0f1128',
  glass:   'rgba(255,255,255,0.04)',
  border:  'rgba(255,255,255,0.08)',
  borderHi:'rgba(255,255,255,0.13)',
  pulse:   '#6c63ff',
  drift:   '#a78bfa',
  flare:   '#f4c842',
  nova:    '#4ade80',
  danger:  '#f87171',
  text:    '#e8e8f0',
  muted:   '#6b6b8a',
};

// Real OAuth client IDs — Google Cloud Console (iOS client) + Firebase's
// auto-generated Web SDK client (needed for a usable id_token). Android
// isn't shipping yet, so no androidClientId is passed below.
const GOOGLE_WEB_CLIENT_ID = '430696585996-5bOh23vec5ps7dpve7c62q50csu21hc2.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '430696585996-qoppb52cibj9q0lmvgfp9gph2ijpq0a7.apps.googleusercontent.com';

// The real Aibram mark — same outline circle + eye dashes as the app icon
// and splash screen, gradient stroke, drawn to spec rather than a placeholder.
const AibramMark = ({ size = 88 }) => {
  const pulse = React.useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.7, duration: 1900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ opacity: pulse }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="orbFill" cx="50%" cy="45%" r="60%">
            <Stop offset="0%" stopColor="#8478ff" />
            <Stop offset="100%" stopColor="#5a4fe0" />
          </RadialGradient>
        </Defs>
        {/* Same filled orb face used throughout the app — Home, the Aibram
            chat header, and Morning Brief — one consistent look everywhere. */}
        <Circle cx={50} cy={50} r={42} stroke="#6c63ff" strokeWidth={1} fill="none" opacity={0.14} />
        <Circle cx={50} cy={50} r={35} stroke="#6c63ff" strokeWidth={1.2} fill="none" opacity={0.22} />
        <Circle cx={50} cy={50} r={28} stroke="#a78bfa" strokeWidth={1.5} fill="none" opacity={0.35} />
        <Circle cx={50} cy={50} r={21} fill="url(#orbFill)" stroke="#a78bfa" strokeWidth={1.6} />
        <Line x1={43} y1={46} x2={43} y2={56} stroke="#fdf6ec" strokeWidth={4.2} strokeLinecap="round" />
        <Line x1={57} y1={46} x2={57} y2={56} stroke="#fdf6ec" strokeWidth={4.2} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
};

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

  let [fontsLoaded] = useFonts({ Inter_400Regular, Inter_700Bold, Inter_900Black });

  // ── Google Auth Setup ──────────────────────────────────────────────────────
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
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
      // _layout.tsx onAuthStateChanged handles navigation
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setGLoading(false);
    }
  };

  // ── Email Auth (unchanged) ──────────────────────────────────────────────────
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
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const friendlyError = (code: string): string => {
    switch (code) {
      case 'auth/email-already-in-use':    return 'That email already has an account. Try signing in.';
      case 'auth/invalid-email':           return "That email doesn't look right.";
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
    <View style={{ flex: 1, backgroundColor: C.void }}>
      {/* Nebula backdrop, matching the app's own space background */}
      <LinearGradient
        colors={[C.nebula, C.deep, C.void]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {STAR_POSITIONS.map((s, i) => (
          <View key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.r, height: s.r, borderRadius: s.r, backgroundColor: '#fff', opacity: s.o }} />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <AibramMark size={88} />
            <Text style={styles.appName}>AIBRAM</Text>
            <Text style={styles.tagline}>Your Home Universe.</Text>
          </View>

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

          {mode === 'signup' && (
            <View style={styles.field}>
              <Ionicons name="person-outline" size={18} color={C.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={C.muted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.field}>
            <Ionicons name="mail-outline" size={18} color={C.muted} style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={C.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={18} color={C.muted} style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={C.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity onPress={() => setShowPw(p => !p)} style={{ padding: 4 }}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#08090f" />
              : <Text style={styles.submitTxt}>{mode === 'signup' ? 'Create Account →' : 'Sign In →'}</Text>
            }
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerTxt}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, (gLoading || !googleRequest) && { opacity: 0.6 }]}
            onPress={() => promptGoogleAsync()}
            disabled={gLoading || !googleRequest}
          >
            {gLoading ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: '#4285F4' }}>G</Text>
                </View>
                <Text style={styles.googleTxt}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>
            {mode === 'signup'
              ? 'By creating an account you agree to our Terms of Service.'
              : 'Your data is saved to the cloud and syncs across devices.'}
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Fixed positions so the starfield doesn't recompute (and flicker) on rerender
const STAR_POSITIONS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 137) % 380,
  y: (i * 211) % 800,
  r: (i % 3) + 1,
  o: 0.3 + (i % 4) * 0.15,
}));

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 28,
    paddingTop: 80,
    paddingBottom: 60,
  },

  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  appName: {
    fontFamily: 'Inter_900Black',
    fontSize: 30, color: C.text, letterSpacing: 5,
    marginTop: 18, marginBottom: 6,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13, color: C.muted,
  },

  toggle: {
    flexDirection: 'row',
    backgroundColor: C.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
    marginBottom: 26,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9,
  },
  toggleActive: {
    backgroundColor: C.pulse,
  },
  toggleTxt: {
    fontFamily: 'Inter_700Bold', fontSize: 14, color: C.muted,
  },
  toggleActiveTxt: {
    color: '#fff',
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 13,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: C.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    paddingVertical: 12,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 11,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
  },
  errorTxt: {
    color: C.danger,
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    flex: 1,
  },

  submitBtn: {
    backgroundColor: C.pulse,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 22,
  },
  submitTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15, color: '#fff',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1, height: 1, backgroundColor: C.border,
  },
  dividerTxt: {
    color: C.muted, fontFamily: 'Inter_400Regular',
    fontSize: 12.5, marginHorizontal: 12,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: C.glass,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 30,
  },
  googleIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  googleTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5, color: C.text,
  },

  footer: {
    color: C.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
  },
});