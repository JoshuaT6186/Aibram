// ═══════════════════════════════════════════════════════════════════════════
// AIBRAM — Life OS · Home Universe Edition
// Single-file React Native conversion of the HTML prototype
// Expo Snack compatible · requires: react-native-svg
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Animated, Easing,
  Dimensions, StatusBar, Modal, KeyboardAvoidingView, Platform, Alert,
  StyleSheet, PanResponder, Image,
} from 'react-native';
import Svg, { Path, Ellipse, Circle, Rect, Line, Defs, LinearGradient, Stop, RadialGradient, Text as SvgText } from 'react-native-svg';
import { auth } from '../../firebase/firebaseConfig'; // adjust path if this file isn't at app/(tabs)/index.tsx
import { signOut, deleteUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Resolved to nativeModules.native.ts on iOS/Android, nativeModules.web.ts on
// web — keeps react-native-purchases and react-native-google-mobile-ads (both
// native-only) out of the web bundle entirely. On web, all five come back null.
import { Purchases, mobileAds, BannerAd, BannerAdSize, TestIds } from '../../nativeModules'; // adjust path if this file isn't at app/(tabs)/index.tsx

const { width: SW, height: SH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG — fill in your real values. Nothing below here is a secret key;
// RevenueCat's SDK keys and AdMob's App/unit IDs are meant to be public
// (they're baked into every shipped app by design). The one secret —
// your Anthropic key — never goes here; see functions/index.js instead.
// ═══════════════════════════════════════════════════════════════════════════

// Deployed URL of functions/index.js's callAibram function. Leave blank to
// run fully on the simulated-reply fallback (useful before you've deployed).
const AIBRAM_FUNCTION_URL = 'https://callaibram-47v4w7avva-uc.a.run.app'; // e.g. 'https://callaibram-xxxxxxxxxx-uc.a.run.app'
const AIBRAM_NEWS_URL = 'https://us-central1-aibram-9c44f.cloudfunctions.net/getMorningNews'; // e.g. 'https://getmorningnews-xxxxxxxxxx-uc.a.run.app' — from deploying getMorningNews
const AIBRAM_ETA_URL = 'https://us-central1-aibram-9c44f.cloudfunctions.net/getETA'; // e.g. 'https://geteta-xxxxxxxxxx-uc.a.run.app' — from deploying getETA
const AIBRAM_PLACES_URL = 'https://us-central1-aibram-9c44f.cloudfunctions.net/getPlaceAutocomplete';


// RevenueCat public SDK keys (Project settings → API keys in the RC dashboard)
const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_ReihYnXmZfICHIZNWSkMSYCRmnj',
  android: '', // paste your Android public SDK key — leave blank if iOS-only for now
});
const RC_ENTITLEMENT_ID = 'Aibram+'; // matches your RevenueCat dashboard entitlement identifier
const RC_OFFERING_ID = null; // null = use your Current Offering; or paste an offering identifier

// AdMob — App IDs go in app.json's config plugin (native-level, not here).
// These are just the ad *unit* IDs for the banner shown in the Aibram chat.
// TestIds.BANNER is Google's official test unit — safe to ship with while
// you're waiting on AdMob account approval, swap for your real unit before
// submitting.
const ADMOB_BANNER_UNIT_ID = Platform.select({
  ios: __DEV__ ? TestIds?.BANNER : 'ca-app-pub-1907484560783416/8650094289',
  android: TestIds?.BANNER, // not shipping Android yet — safe test placeholder so this never crashes if the code path is hit
});

// ─── THEME ──────────────────────────────────────────────────────────────────
const C = {
  void: '#05060f',
  deep: '#0a0b1a',
  nebula: '#0f1128',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassHi: 'rgba(255,255,255,0.13)',
  pulse: '#6c63ff',
  pulseGlow: 'rgba(108,99,255,0.28)',
  drift: '#a78bfa',
  flare: '#f4c842',
  nova: '#4ade80',
  red: '#f87171',
  orange: '#fb923c',
  text: '#e8e8f0',
  muted: '#6b6b8a',
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };
const fmtDate = (str, opts = {}) => new Date(str + 'T12:00:00').toLocaleDateString('en-US', opts);
const parseTime = (t) => {
  if (!t) return 9999;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + parseInt(m[2]);
};
const spFmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const getXPRank = (xp) => {
  const ranks = [{ name: 'Drifter', min: 0 }, { name: 'Cadet', min: 150 }, { name: 'Explorer', min: 400 }, { name: 'Pioneer', min: 800 }, { name: 'Commander', min: 1500 }, { name: 'Architect', min: 3000 }];
  return [...ranks].reverse().find(r => xp >= r.min) || ranks[0];
};
const RANKS = [{ name: 'Drifter', min: 0 }, { name: 'Cadet', min: 150 }, { name: 'Explorer', min: 400 }, { name: 'Pioneer', min: 800 }, { name: 'Commander', min: 1500 }, { name: 'Architect', min: 3000 }];

// ─── INITIAL STATE ──────────────────────────────────────────────────────────
// All empty for a real first run — a genuine new user starts with nothing,
// not a pre-loaded fake life. Budgets keep sane starting limits since those
// are app config, not personal history.
const initialTasks = [];
const initialEvents = [];
const initialNodes = [];
const initialConnections = [];
const initialGoals = [];
const initialProjects = [];
const initialMemories = [];
const initialChapters = [];
const initialTimeline = [];
const initialTransactions = [];
const initialBudgets = {
  Food: { limit: 150, icon: 'food' }, Coffee: { limit: 30, icon: 'coffee' }, Tech: { limit: 50, icon: 'laptop' },
  Transport: { limit: 60, icon: 'gas' }, Subscriptions: { limit: 30, icon: 'zap' },
  Entertainment: { limit: 40, icon: 'controller' }, Other: { limit: 50, icon: 'package' },
};
const SPEND_CATS = ['Food', 'Coffee', 'Tech', 'Transport', 'Subscriptions', 'Entertainment', 'Other'];
const SPEND_ICONS = { Food: 'food', Coffee: 'coffee', Tech: 'laptop', Transport: 'gas', Subscriptions: 'zap', Entertainment: 'controller', Other: 'package' };

// Real ambient audio sources — bundled local assets, so they play offline
// and reliably during a demo (no network dependency).
const AMBIENT_SOURCES = {
  rain: require('../../assets/sounds/rain.mp3'),
  white: require('../../assets/sounds/whitenoise.mp3'),
  forest: require('../../assets/sounds/forest.mp3'),
  lofi: require('../../assets/sounds/lofi.mp3'),
};

// Small hook wrapping expo-av for looped ambient playback. Handles load,
// loop, stop, and cleanup so FocusPanel doesn't need to touch Audio.Sound
// directly. Returns null sound object gracefully if a file is missing so a
// forgotten asset doesn't crash the session — it just plays nothing.
function useAmbientSound() {
  const soundRef = useRef(null);

  const play = async (soundId) => {
    await stop();
    if (soundId === 'none' || !AMBIENT_SOURCES[soundId]) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(AMBIENT_SOURCES[soundId], {
        isLooping: true, volume: 0.6, shouldPlay: true,
      });
      soundRef.current = sound;
    } catch (e) {
      console.log('Ambient sound failed to load:', e);
    }
  };

  const stop = async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch (e) {}
      soundRef.current = null;
    }
  };

  useEffect(() => () => { stop(); }, []);

  return { play, stop };
}

// ─── COACH MARKS — lightweight first-visit tips, one per tab ───────────────
// Shown once per tab, dismissed by tap, remembered via AsyncStorage so they
// don't reappear on the next app open. Intentionally simple (a dismissible
// banner, not a full spotlight overlay) to stay low-risk this close to
// submission while still being genuinely interactive and tab-aware.
const COACHMARK_TEXT = {
  home: 'This is your daily orbit. Tap any planet — Planning, Focus, Space — to open it. Tap the pulsing Aibram orb to talk to your AI partner anytime.',
  planning: 'Tap any day to see what\'s on it. Tap "+ Add" for a quick commitment, or tap an existing item to edit its time, priority, or location.',
  aibram: 'Aibram already knows your tasks, goals, and ideas — ask it anything, or try one of the suggestions below.',
  focus: 'Deep Focus locks in on one task with a timer. Mindfulness is just breathing, no pressure, no clock watching.',
  space: 'Every idea is a small dot — tap one to see the full thought. Drag ideas around, or tap "Auto-organize" to let Aibram connect related ones.',
  user: 'This is your growth over time — rank, XP, goals, and everything Aibram remembers about you.',
};

const Coachmark = ({ id, seen, onDismiss, style }) => {
  if (seen) return null;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: fade, marginTop: 4, marginBottom: 4 }, style]}>
      <View style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13,
        backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', borderRadius: 13,
      }}>
        <View style={{ marginTop: 1 }}><PulseDot color={C.drift} /></View>
        <Text style={{ flex: 1, fontSize: 12, color: '#d4d4e8', lineHeight: 18 }}>{COACHMARK_TEXT[id]}</Text>
        <TouchableOpacity onPress={onDismiss} style={{ padding: 2 }}>
          <Text style={{ color: C.muted, fontSize: 14 }}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── SHIP SVG ───────────────────────────────────────────────────────────────
// Ship evolves with rank — growth made visible, not just a number.
// tier: 0 Drifter · 1 Cadet · 2 Explorer · 3 Pioneer · 4 Commander · 5 Architect
const RANK_SHIP_STYLE = [
  { accent: '#8b93a8', hullTop: '#e8e8f0', hullBot: '#5b6578', engine: '#8b93a8' },   // Drifter — plain gray drifting hull
  { accent: '#6c63ff', hullTop: '#ffffff', hullBot: '#718299', engine: '#6c63ff' },   // Cadet — the classic ship
  { accent: '#6c63ff', hullTop: '#ffffff', hullBot: '#6f7fd8', engine: '#a78bfa' },   // Explorer — violet engines
  { accent: '#a78bfa', hullTop: '#ffffff', hullBot: '#7d6fd8', engine: '#a78bfa' },   // Pioneer — violet accent hull
  { accent: '#f4c842', hullTop: '#fffdf2', hullBot: '#8a7fd8', engine: '#f4c842' },   // Commander — gold trim
  { accent: '#f4c842', hullTop: '#fff8dd', hullBot: '#b09af0', engine: '#4ade80' },   // Architect — gold hull, nova engines
];
const rankTier = (xp) => Math.max(0, RANKS.findIndex(r => r.name === getXPRank(xp).name));

const Ship = ({ w = 56, h = 80, id = 'shipG', tier = 1 }) => {
  const s = RANK_SHIP_STYLE[Math.min(tier, RANK_SHIP_STYLE.length - 1)] || RANK_SHIP_STYLE[1];
  return (
    <Svg width={w} height={h} viewBox="0 0 120 170" fill="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop stopColor={s.hullTop} />
          <Stop offset="0.6" stopColor="#b8c6da" />
          <Stop offset="1" stopColor={s.hullBot} />
        </LinearGradient>
      </Defs>
      {/* Architect only: faint aura ring behind the hull */}
      {tier >= 5 && <Ellipse cx="60" cy="85" rx="54" ry="76" stroke={s.accent} strokeWidth="1.5" opacity="0.35" />}
      <Path d="M60 6C44 30 34 59 34 98v28l26 24 26-24V98C86 59 76 30 60 6Z" fill={`url(#${id})`} stroke={s.accent} strokeWidth="2" />
      {/* Wings appear at Explorer+; Drifter/Cadet fly bare-hulled */}
      {tier >= 2 && <Path d="M34 91 12 126l25-7M86 91l22 35-25-7" fill="#53647c" stroke="#8fa2bb" strokeWidth="2" />}
      {/* Second wing tier for Commander+ */}
      {tier >= 4 && <Path d="M36 62 22 84l16-4M84 62l14 22-16-4" fill="#3d4a5f" stroke={s.accent} strokeWidth="1.5" opacity="0.85" />}
      <Ellipse cx="60" cy="68" rx="12" ry="16" fill="#0e1a2a" stroke={s.accent} strokeWidth="2" />
      {/* Hull detail stripes from Pioneer up */}
      {tier >= 3 && <Path d="M46 108h28M46 118h28" stroke={s.accent} strokeWidth="2" opacity="0.6" strokeLinecap="round" />}
      <Path d="M48 144 55 165M72 144l-7 21" stroke={s.engine} strokeWidth="6" strokeLinecap="round" />
      {/* Third center engine for Commander+ */}
      {tier >= 4 && <Path d="M60 148v20" stroke={s.engine} strokeWidth="5" strokeLinecap="round" />}
    </Svg>
  );
};

// ─── STARFIELD ──────────────────────────────────────────────────────────────
const StarField = React.memo(() => {
  const stars = Array.from({ length: 70 }, (_, i) => ({
    key: i,
    size: i % 9 === 0 ? 2 : i % 3 === 0 ? 1.5 : 1,
    x: ((i * 37.7) % 100),
    y: ((i * 61.3) % 100),
    op: 0.18 + (i % 7) * 0.05,
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map(s => (
        <View key={s.key} style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: s.size / 2,
          backgroundColor: '#fff', opacity: s.op,
        }} />
      ))}
    </View>
  );
});

// ─── FLOATING WRAPPER (planet float animation) ──────────────────────────────
const Floaty = ({ children, dur = 9000, delay = 0, dy = -7, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[style, { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }] }]}>
      {children}
    </Animated.View>
  );
};

// ─── PULSING DOT ────────────────────────────────────────────────────────────
const PulseDot = ({ color = C.pulse, size = 6 }) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: anim }} />;
};

// ─── GLASS CARD ─────────────────────────────────────────────────────────────
const Glass = ({ children, style }) => (
  <View style={[{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 16, overflow: 'hidden' }, style]}>
    {children}
  </View>
);

const Kicker = ({ children, color = C.pulse, style }) => (
  <Text style={[{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color, fontWeight: '700', marginBottom: 6 }, style]}>{children}</Text>
);

// ─── NAV ICONS — line icons matching the prototype's sidebar, no emoji ──────
const NAV_ICON_SHAPES = {
  // House — universally legible beats thematically clever for Home
  home: [
    { t: 'p', d: 'M3 10.5 12 3l9 7.5' },
    { t: 'p', d: 'M5.5 9.5V20h13V9.5' },
    { t: 'p', d: 'M10 20v-5.5h4V20' },
  ],
  planning: [
    { t: 'r', x: 3, y: 4, w: 18, h: 18, rx: 3 },
    { t: 'p', d: 'M8 2v4M16 2v4M3 10h18' },
  ],
  // Aibram's actual face — circle with the two eye-dashes, matching the orb
  aibram: [
    { t: 'c', cx: 12, cy: 12, r: 9 },
    { t: 'p', d: 'M9.5 9.5v4M14.5 9.5v4' },
  ],
  // Hourglass — matches what Focus actually is: a countdown
  focus: [
    { t: 'p', d: 'M6 3h12M6 21h12' },
    { t: 'p', d: 'M7 3c0 5 4 5.5 4 9s-4 4-4 9M17 3c0 5-4 5.5-4 9s4 4 4 9' },
  ],
  space: [
    { t: 'c', cx: 5, cy: 12, r: 2.5 },
    { t: 'c', cx: 18, cy: 5, r: 2.5 },
    { t: 'c', cx: 19, cy: 18, r: 2.5 },
    { t: 'p', d: 'm7.3 10.9 8.4-4.8M7.3 13.2l9.4 3.7' },
  ],
  user: [
    { t: 'c', cx: 12, cy: 8, r: 4 },
    { t: 'p', d: 'M4.5 21a7.5 7.5 0 0 1 15 0' },
  ],
};
// ─── ICON — general-purpose thin-line icon set replacing all emoji in the app ──
// Same shape language as NAV_ICON_SHAPES: {t:'p', d} path, {t:'c'} circle, {t:'r'} rect.
const ICON_SHAPES = {
  // weather
  'sun': [{ t: 'c', cx: 12, cy: 12, r: 4.2 }, { t: 'p', d: 'M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8' }],
  'cloud': [{ t: 'p', d: 'M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7A3.5 3.5 0 0 0 7 18Z' }],
  'cloud-sun': [{ t: 'c', cx: 7.5, cy: 6.5, r: 3 }, { t: 'p', d: 'M7.5 1.7v1.4M3 6.5H1.6M4.3 3.3 3.3 2.3M4.3 3.3l1 1' }, { t: 'p', d: 'M9 19h9a3.6 3.6 0 0 0 0-7.2 5 5 0 0 0-9.4 1.5A3.1 3.1 0 0 0 9 19Z' }],
  'cloud-rain': [{ t: 'p', d: 'M6.5 15.5h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7 3.5 3.5 0 0 0 .6 6.3Z' }, { t: 'p', d: 'M8 19.5l-1 2.2M12 19.5l-1 2.2M16 19.5l-1 2.2' }],
  'cloud-snow': [{ t: 'p', d: 'M6.5 14.5h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7 3.5 3.5 0 0 0 .6 6.3Z' }, { t: 'p', d: 'M8 19v2.4M7 20.2h2M12 19.5v2.4M11 20.7h2M16 19v2.4M15 20.2h2' }],
  'cloud-storm': [{ t: 'p', d: 'M6.5 13.5h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7 3.5 3.5 0 0 0 .6 6.3Z' }, { t: 'p', d: 'M13 15l-3 5h3l-2 4' }],
  'cloud-fog': [{ t: 'p', d: 'M6.5 11.5h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 2.2' }, { t: 'p', d: 'M5 15h14M4 18.5h16M6 21.5h12' }],
  'thermometer': [{ t: 'p', d: 'M12 14.5V4.5a2 2 0 1 0-4 0v10a4 4 0 1 0 4 0Z' }],
  // vibes
  'battery': [{ t: 'r', x: 2.5, y: 8, w: 15, h: 8, rx: 2 }, { t: 'p', d: 'M19.5 10.5v3' }, { t: 'p', d: 'M5.5 10.5v3' }],
  'zap': [{ t: 'p', d: 'M12.5 2.5 5 13.5h5.5L11 21.5l7.5-11H13l-.5-8Z' }],
  'flame': [{ t: 'p', d: 'M12 2.5c1 3-3 4.3-3 8a3 3 0 0 0 6 0c1.3.9 2 2.4 2 4a5 5 0 0 1-10 0c0-4.5 3-6 5-12Z' }],
  // music transport
  'play': [{ t: 'p', d: 'M7 4.5v15l13-7.5-13-7.5Z' }],
  'pause': [{ t: 'p', d: 'M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z' }],
  'skip-back': [{ t: 'p', d: 'M6 5v14M20 6 9 12l11 6V6Z' }],
  'skip-forward': [{ t: 'p', d: 'M18 5v14M4 6l11 6L4 18V6Z' }],
  // misc UI
  'paperclip': [{ t: 'p', d: 'M8 12.5V7.5a4 4 0 0 1 8 0v9a2.5 2.5 0 0 1-5 0v-8a1 1 0 1 1 2 0v7' }],
  'trash': [{ t: 'p', d: 'M4.5 6.5h15M9 6.5V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 6.5l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13' }],
  'edit': [{ t: 'p', d: 'M4 20h3.2L18 9.2a1.7 1.7 0 0 0 0-2.4l-.8-.8a1.7 1.7 0 0 0-2.4 0L4 16.8V20Z' }],
  'lightbulb': [{ t: 'p', d: 'M9 21h6M10 18.5h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z' }],
  'search': [{ t: 'c', cx: 11, cy: 11, r: 6.5 }, { t: 'p', d: 'M20 20l-4.3-4.3' }],
  'timer': [{ t: 'c', cx: 12, cy: 13, r: 8 }, { t: 'p', d: 'M12 9v4l3 2M9.5 2h5' }],
  'leaf': [{ t: 'p', d: 'M20 4.5C10 4.5 4.5 10 4.5 20 14.5 20 20 14.5 20 4.5ZM4.5 20 12 12.5' }],
  'heart': [{ t: 'p', d: 'M12 20.2 4.5 13a5 5 0 0 1 7-7.1L12 6.3l.5-.4a5 5 0 0 1 7 7.1L12 20.2Z' }],
  'calendar': [{ t: 'r', x: 3.5, y: 5, w: 17, h: 15.5, rx: 2.5 }, { t: 'p', d: 'M8 3v4M16 3v4M3.5 10h17' }],
  'card': [{ t: 'r', x: 2.5, y: 5.5, w: 19, h: 13, rx: 2.5 }, { t: 'p', d: 'M2.5 9.5h19' }],
  'clock': [{ t: 'c', cx: 12, cy: 12, r: 8.5 }, { t: 'p', d: 'M12 7.5v4.7l3.3 2' }],
  'warning': [{ t: 'p', d: 'M12 3 2.5 20h19L12 3Z' }, { t: 'p', d: 'M12 10v4' }, { t: 'c', cx: 12, cy: 17, r: 0.4 }],
  'swap': [{ t: 'p', d: 'M7 5.5 3 9.5m0 0 4 4M3 9.5h14M17 18.5l4-4m0 0-4-4m4 4H7' }],
  // spending categories
  'food': [{ t: 'p', d: 'M4.5 10.5c0-4 3.5-7 7.5-7s7.5 3 7.5 7H4.5Z' }, { t: 'p', d: 'M3.5 10.5h17M5 13.5h14l-1.3 6.5a2 2 0 0 1-2 1.6H8.3a2 2 0 0 1-2-1.6L5 13.5Z' }],
  'coffee': [{ t: 'p', d: 'M4.5 8.5h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-6Z' }, { t: 'p', d: 'M16.5 9.5H18a2.5 2.5 0 0 1 0 5h-1.5' }, { t: 'p', d: 'M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2' }],
  'laptop': [{ t: 'r', x: 4, y: 5, w: 16, h: 10.5, rx: 1.5 }, { t: 'p', d: 'M2.5 19.5h19l-1.5-2h-16l-1.5 2Z' }],
  'gas': [{ t: 'r', x: 4.5, y: 4.5, w: 9, h: 15.5, rx: 1.5 }, { t: 'p', d: 'M13.5 9h2.3L18.5 11.5v6a1.5 1.5 0 0 1-3 0V14h-2M7 8.5h4' }],
  'package': [{ t: 'p', d: 'M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z' }, { t: 'p', d: 'M3.5 8v9l8.5 4.5M20.5 8v9L12 21.5M12 12.5v9' }],
  'controller': [{ t: 'p', d: 'M6 8.5h12l2 8a2 2 0 0 1-3.4 1.7L14 15.5h-4l-2.6 2.7A2 2 0 0 1 4 16.5l2-8Z' }, { t: 'p', d: 'M8.5 11v3M7 12.5h3' }, { t: 'c', cx: 16, cy: 11.5, r: 0.6 }, { t: 'c', cx: 17.5, cy: 13, r: 0.6 }],
  'cart': [{ t: 'p', d: 'M3 4.5h2.3l1.4 10.4a1.8 1.8 0 0 0 1.8 1.6h8.4a1.8 1.8 0 0 0 1.8-1.5L20.5 8H6' }, { t: 'c', cx: 9, cy: 20, r: 1.2 }, { t: 'c', cx: 17, cy: 20, r: 1.2 }],
};
const Icon = ({ name, size = 15, color, strokeWidth = 1.8, style, filled = false }) => {
  const shapes = ICON_SHAPES[name] || [];
  const c = color || C.muted;
  // play/pause/heart read better filled solid rather than outlined
  const solid = filled || name === 'play' || name === 'pause';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {shapes.map((s, i) => {
        if (s.t === 'c' && s.r < 0.7) return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={c} />;
        if (s.t === 'c') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} stroke={c} strokeWidth={strokeWidth} fill={solid ? c : 'none'} />;
        if (s.t === 'r') return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} stroke={c} strokeWidth={strokeWidth} fill={solid ? c : 'none'} />;
        return <Path key={i} d={s.d} stroke={c} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={solid ? c : 'none'} />;
      })}
    </Svg>
  );
};
const WEATHER_ICON_BY_CODE = {
  0: 'sun', 1: 'cloud-sun', 2: 'cloud-sun', 3: 'cloud',
  45: 'cloud-fog', 48: 'cloud-fog',
  51: 'cloud-rain', 53: 'cloud-rain', 55: 'cloud-rain',
  61: 'cloud-rain', 63: 'cloud-rain', 65: 'cloud-rain', 66: 'cloud-rain', 67: 'cloud-rain',
  71: 'cloud-snow', 73: 'cloud-snow', 75: 'cloud-snow', 77: 'cloud-snow',
  80: 'cloud-rain', 81: 'cloud-rain', 82: 'cloud-rain',
  85: 'cloud-snow', 86: 'cloud-snow', 95: 'cloud-storm', 96: 'cloud-storm', 99: 'cloud-storm',
};

const NavIcon = ({ name, active, size = 20 }) => {
  const color = active ? C.pulse : C.muted;
  const shapes = NAV_ICON_SHAPES[name] || [];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {shapes.map((s, i) => {
        if (s.t === 'c') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} stroke={color} strokeWidth={1.8} opacity={s.o ?? 1} />;
        if (s.t === 'r') return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} stroke={color} strokeWidth={1.8} />;
        return <Path key={i} d={s.d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </Svg>
  );
};

// ─── AIBRAM LOADER — spinning gradient ring for loading states ──────────────
// Same face as the logo (ring + eye dashes), used wherever the app needs to
// show it's working: app boot, Deep Memory hydration, longer AI calls.
const AibramLoader = ({ size = 120, label }) => {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.55, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    spinLoop.start();
    pulseLoop.start();
    return () => { spinLoop.stop(); pulseLoop.stop(); };
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const r = size * 0.32;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="loaderG" x1="10%" y1="0%" x2="90%" y2="100%">
              <Stop offset="0%" stopColor="#a78bfa" />
              <Stop offset="50%" stopColor="#6c63ff" />
              <Stop offset="100%" stopColor="#f4c842" />
            </LinearGradient>
          </Defs>
          <Circle cx={50} cy={50} r={32} stroke="#3a3d6b" strokeWidth={5} opacity={0.3} fill="none" />
          <Circle
            cx={50} cy={50} r={32} stroke="url(#loaderG)" strokeWidth={5} fill="none"
            strokeLinecap="round" strokeDasharray={`${circumference * 0.32} ${circumference}`}
          />
        </Svg>
      </Animated.View>
      <View style={{
        position: 'absolute', width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25,
        backgroundColor: 'rgba(108,99,255,0.16)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.4)',
      }} />
      <Animated.View style={{ opacity: pulse, flexDirection: 'row', gap: size * 0.045 }}>
        <View style={{ width: size * 0.028, height: size * 0.09, borderRadius: 3, backgroundColor: '#fdf6ec' }} />
        <View style={{ width: size * 0.028, height: size * 0.09, borderRadius: 3, backgroundColor: '#fdf6ec' }} />
      </Animated.View>
      {label && <Text style={{ position: 'absolute', bottom: -28, fontSize: 12, color: C.muted, width: size * 2.2, textAlign: 'center', left: -size * 0.6 }}>{label}</Text>}
    </View>
  );
};

// ─── AIBRAM ORB — breathing companion presence, used on Home + chat header ──
const AibramOrb = ({ size = 58, notice = false, thinking = false }) => {
  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: thinking ? 700 : 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: thinking ? 700 : 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [thinking]);
  useEffect(() => {
    let cancelled = false;
    let handle;
    const scheduleBlink = () => {
      handle = setTimeout(() => {
        if (cancelled) return;
        Animated.sequence([
          Animated.timing(blink, { toValue: 0.15, duration: 90, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start(() => { if (!cancelled) scheduleBlink(); });
      }, 2200 + Math.random() * 2600);
    };
    scheduleBlink();
    return () => { cancelled = true; clearTimeout(handle); };
  }, []);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.3, notice ? 0.85 : 0.5] });
  const ringColor = thinking ? C.drift : notice ? C.flare : C.pulse;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 1, borderColor: ringColor, opacity: glowOpacity, transform: [{ scale }],
      }} />
      <Animated.View style={{
        width: size * 0.72, height: size * 0.72, borderRadius: size * 0.36,
        backgroundColor: 'rgba(108,99,255,0.16)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.4)',
        alignItems: 'center', justifyContent: 'center', transform: [{ scale }],
      }}>
        <Animated.View style={{ flexDirection: 'row', gap: 7, opacity: blink }}>
          <View style={{ width: 3, height: size * 0.12, borderRadius: 2, backgroundColor: '#fff' }} />
          <View style={{ width: 3, height: size * 0.12, borderRadius: 2, backgroundColor: '#fff' }} />
        </Animated.View>
      </Animated.View>
      {notice && <View style={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: C.flare, borderWidth: 2, borderColor: C.void }} />}
    </View>
  );
};

// ─── SLOWLY-SPINNING ORBIT RING ─────────────────────────────────────────────
const OrbitRing = ({ size, dur = 80000, reverse }) => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2,
      width: size, height: size, borderRadius: size / 2, borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed',
      transform: [{ rotate }],
    }} />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — 6 screens
// ═══════════════════════════════════════════════════════════════════════════
// Goal chips reorder per age bracket — same pool, life-stage-relevant ones
// surface first, least-relevant drop off the end.
const OB_AGE_BRACKETS = ['13–17', '18–24', '25–34', '35–49', '50+'];
const OB_GOALS_BY_AGE = {
  '13–17': ['Finish school strong', 'Get into a great school', 'Figure out who I want to be', 'Build a skill that lasts', 'Get healthier and stronger', 'Be more consistent', "Build something I'm proud of", 'Earn real money'],
  '18–24': ['Launch something I built', 'Build a skill that lasts', 'Finish school strong', 'Earn real money', 'Figure out who I want to be', 'Get healthier and stronger', "Build something I'm proud of", 'Be more consistent'],
  '25–34': ['Grow in my career', 'Launch something I built', 'Earn real money', 'Build a skill that lasts', 'Get healthier and stronger', "Build something I'm proud of", 'Be more consistent', 'Find better balance'],
  '35–49': ['Grow in my career', 'Find better balance', 'Get healthier and stronger', "Build something I'm proud of", 'Earn real money', 'Be more consistent', 'Build a skill that lasts', 'Invest in my family'],
  '50+': ['Get healthier and stronger', 'Find better balance', "Build something I'm proud of", 'Invest in my family', 'Build a skill that lasts', 'Be more consistent', 'Give back and mentor', 'Earn real money'],
};
const OB_GOALS_DEFAULT = ['Launch something I built', 'Build a skill that lasts', 'Get healthier and stronger', 'Earn real money', "Build something I'm proud of", 'Be more consistent', 'Figure out who I want to be'];
const OB_STRUGGLES = ['Staying focused', 'Getting started', 'Finishing what I start', 'Managing my time', 'Staying motivated', 'Knowing what to prioritize', 'Overthinking', 'Being consistent', 'Balancing everything'];
const OB_VIBES = [
  { name: 'Recharging', icon: 'battery', desc: 'Running low. Need gentle support and less noise.', color: C.orange, rgb: '251,146,60' },
  { name: 'Steady', icon: 'zap', desc: 'Good to go. Ready to build and move forward.', color: C.pulse, rgb: '108,99,255' },
  { name: 'Locked In', icon: 'flame', desc: 'Fired up. Push hard, stay focused, go further.', color: C.nova, rgb: '74,222,128' },
];

const Onboarding = ({ onDone }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [ageBracket, setAgeBracket] = useState(null);
  const [goals, setGoals] = useState([]);
  const [struggles, setStruggles] = useState([]);
  const [vibe, setVibe] = useState('Steady');
  const fade = useRef(new Animated.Value(1)).current;
  const TOTAL_STEPS = 8;

  const next = () => {
    if (step >= TOTAL_STEPS) { onDone({ name: name.trim() || 'Explorer', vibe, ageBracket, goals, struggles }); return; }
    Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setStep(s => s + 1);
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    });
  };

  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const ChoiceChips = ({ items, sel, onToggle, accent = C.pulse }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9, marginBottom: 28 }}>
      {items.map(item => {
        const on = sel.includes(item);
        return (
          <TouchableOpacity key={item} onPress={() => onToggle(item)} style={{
            paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1,
            borderColor: on ? accent + '88' : 'rgba(255,255,255,0.1)',
            backgroundColor: on ? accent + '1a' : 'rgba(255,255,255,0.03)',
          }}>
            <Text style={{ color: on ? accent : C.muted, fontSize: 13, fontWeight: '500' }}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const Headline = ({ children, size = 34 }) => (
    <Text style={{ fontSize: size, fontWeight: '700', color: C.text, textAlign: 'center', lineHeight: size * 1.1, marginBottom: 14, letterSpacing: -1 }}>{children}</Text>
  );
  const Sub = ({ children }) => (
    <Text style={{ fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 24, maxWidth: 340, marginBottom: 30 }}>{children}</Text>
  );
  const Primary = ({ label, onPress }) => (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: C.pulse, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 38, shadowColor: C.pulse, shadowOpacity: 0.4, shadowRadius: 18, elevation: 8 }}>
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
  const Ghost = ({ label, onPress }) => (
    <TouchableOpacity onPress={onPress} style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
      <Text style={{ color: C.muted, fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
  const Eyebrow = ({ children }) => (
    <Text style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.pulse, marginBottom: 14, fontWeight: '700' }}>{children}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.void }}>
      <StarField />
      {/* Progress pips */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 54, gap: 8 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
          <View key={n} style={{
            width: n === step ? 40 : 24, height: 3, borderRadius: 999,
            backgroundColor: n < step ? C.pulse : n === step ? C.drift : 'rgba(255,255,255,0.12)',
          }} />
        ))}
      </View>

      <Animated.ScrollView style={{ flex: 1, opacity: fade }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {step === 1 && (<>
          <View style={{ marginBottom: 28, alignItems: 'center' }}>
            <Ship w={76} h={110} id="obShip" />
            <View style={{ width: 44, height: 14, borderRadius: 8, backgroundColor: C.pulse, opacity: 0.5, marginTop: -6 }} />
          </View>
          <Eyebrow>Eternity Works</Eyebrow>
          <Headline size={38}>You were built{'\n'}for <Text style={{ color: C.drift }}>more than this.</Text></Headline>
          <Sub>Aibram is the AI partner that helps you count your stars — and actually reach them. Not a to-do list. A Life OS built around who you're becoming.</Sub>
          <Primary label="Begin your universe →" onPress={next} />
        </>)}

        {step === 2 && (<>
          <Eyebrow>First things first</Eyebrow>
          <Headline size={32}>What do we{'\n'}call you?</Headline>
          <Sub>Your name is the center of your universe.{'\n'}Everything else orbits it.</Sub>
          <TextInput
            value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="rgba(255,255,255,0.16)"
            maxLength={28} autoFocus onSubmitEditing={next}
            style={{
              width: '100%', maxWidth: 340, color: C.text, fontSize: 28, fontWeight: '600', textAlign: 'center',
              paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'rgba(108,99,255,0.35)', marginBottom: 32,
            }}
          />
          <Primary label="Continue →" onPress={next} />
        </>)}

        {step === 3 && (<>
          <Eyebrow>Your season</Eyebrow>
          <Headline size={30}>Where are you{'\n'}in the journey?</Headline>
          <Sub>Different seasons call for different stars. This shapes what Aibram pays attention to.</Sub>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9, marginBottom: 28 }}>
            {OB_AGE_BRACKETS.map(b => {
              const on = ageBracket === b;
              return (
                <TouchableOpacity key={b} onPress={() => setAgeBracket(b)} style={{
                  paddingVertical: 13, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1,
                  borderColor: on ? 'rgba(108,99,255,0.55)' : 'rgba(255,255,255,0.1)',
                  backgroundColor: on ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.03)',
                }}>
                  <Text style={{ color: on ? C.drift : C.muted, fontSize: 16, fontWeight: '600' }}>{b}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Primary label="That's my season →" onPress={next} />
        </>)}

        {step === 4 && (<>
          <Eyebrow>Your goals</Eyebrow>
          <Headline size={28}>What are you{'\n'}building toward?</Headline>
          <Sub>Choose everything that feels true right now.</Sub>
          <ChoiceChips items={ageBracket ? OB_GOALS_BY_AGE[ageBracket] : OB_GOALS_DEFAULT} sel={goals} onToggle={v => toggle(goals, setGoals, v)} />
          <Primary label="That's my focus →" onPress={next} />
        </>)}

        {step === 5 && (<>
          <Eyebrow>The honest part</Eyebrow>
          <Headline size={28}>What gets in{'\n'}your way?</Headline>
          <Sub>Aibram doesn't judge this. It uses it to support you better.</Sub>
          <ChoiceChips items={OB_STRUGGLES} sel={struggles} onToggle={v => toggle(struggles, setStruggles, v)} accent={C.flare} />
          <Primary label="Aibram has you →" onPress={next} />
        </>)}

        {step === 6 && (<>
          <Eyebrow>Right now, today</Eyebrow>
          <Headline size={28}>How are you{'\n'}showing up?</Headline>
          <Sub>Aibram adapts to your energy. Change this anytime.</Sub>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 30 }}>
            {OB_VIBES.map(v => {
              const on = vibe === v.name;
              return (
                <TouchableOpacity key={v.name} onPress={() => setVibe(v.name)} style={{
                  flex: 1, backgroundColor: on ? `rgba(${v.rgb},0.1)` : C.glass, borderWidth: 1,
                  borderColor: on ? `rgba(${v.rgb},0.45)` : C.glassBorder, borderRadius: 18, padding: 16, alignItems: 'center',
                }}>
                  <View style={{ marginBottom: 8 }}><Icon name={v.icon} size={24} color={v.color} /></View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 4, textAlign: 'center' }}>{v.name}</Text>
                  <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 15 }}>{v.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Primary label="This is me today →" onPress={next} />
        </>)}

        {step === 7 && (<>
          <Eyebrow>You're all set</Eyebrow>
          <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            {[80, 140, 200].map((size, i) => (
              <View key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)' }} />
            ))}
            <Ship w={64} h={92} id="obReveal" />
            {[
              { top: 0, left: 90, color: '101,167,255', iconName: 'calendar' },
              { top: 90, right: 0, color: '74,222,128', glyph: '◎' },
              { bottom: 0, left: 90, color: '167,139,250', glyph: '✦' },
              { top: 90, left: 0, color: '244,200,66', glyph: '≡' },
            ].map((p, i) => (
              <View key={i} style={{
                position: 'absolute', ...p, width: 40, height: 40, borderRadius: 20,
                backgroundColor: `rgba(${p.color},0.12)`, borderWidth: 1, borderColor: `rgba(${p.color},0.3)`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {p.iconName ? <Icon name={p.iconName} size={16} color={`rgb(${p.color})`} /> : <Text style={{ fontSize: 14, color: `rgb(${p.color})` }}>{p.glyph}</Text>}
              </View>
            ))}
          </View>
          <Headline size={26}>You're ready to go,{'\n'}<Text style={{ color: C.drift }}>{name.trim() || 'Explorer'}</Text>.</Headline>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, maxWidth: 340, marginBottom: 30 }}>
            {[
              ['AI that knows your whole world', '101,167,255'],
              ['Focus that protects attention', '74,222,128'],
              ['Space for your thinking', '167,139,250'],
              ['Timeline of your growth', '244,200,66'],
            ].map(([label, rgb]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 13, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: `rgb(${rgb})` }} />
                <Text style={{ fontSize: 11, color: C.muted }}>{label}</Text>
              </View>
            ))}
          </View>
          <Primary label="Show me around →" onPress={next} />
        </>)}

        {step === 8 && (<>
          <Eyebrow>Quick tour</Eyebrow>
          <Headline size={26}>Here's where{'\n'}everything lives.</Headline>
          <Sub>Six places, always one tap away — the bar along the bottom never changes.</Sub>
          <View style={{ width: '100%', maxWidth: 360, gap: 10, marginBottom: 30 }}>
            {[
              ['home', 'Home', 'Your daily orbit — weather, tasks, and what to focus on next'],
              ['planning', 'Plan', 'Calendar and spending, with real drive-time reminders'],
              ['aibram', 'Aibram', 'A real AI that knows your world and can actually take action for you'],
              ['focus', 'Focus', 'Timed, distraction-free sessions that protect your attention'],
              ['space', 'Space', 'A living map of your ideas — capture a thought, watch it connect'],
              ['user', 'You', 'Your growth, your rank, and everything Aibram remembers'],
            ].map(([icon, label, desc]) => (
              <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(108,99,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <NavIcon name={icon} active size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 }}>{label}</Text>
                  <Text style={{ fontSize: 11.5, color: C.muted, lineHeight: 16 }}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <Primary label="Enter your universe →" onPress={next} />
        </>)}
      </Animated.ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HOME UNIVERSE
// ═══════════════════════════════════════════════════════════════════════════
const OrbitAsteroids = ({ tasks, onTap, dismissingIds }) => {
  const rotAnims = useRef({}).current;
  const pulseAnims = useRef({}).current;
  const dismissAnims = useRef({}).current;

  tasks.forEach(t => {
    if (!rotAnims[t.id]) rotAnims[t.id] = new Animated.Value(0);
    if (!pulseAnims[t.id]) pulseAnims[t.id] = new Animated.Value(0);
    if (!dismissAnims[t.id]) dismissAnims[t.id] = new Animated.Value(1);
  });

  const idKey = tasks.map(t => t.id).join(',');
  useEffect(() => {
    const loops = tasks.map((t, i) => {
      const rot = Animated.loop(Animated.timing(rotAnims[t.id], {
        toValue: 1, duration: (22 + i * 3) * 1000, easing: Easing.linear, useNativeDriver: true,
      }));
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnims[t.id], { toValue: 1, duration: 1300 + (i % 3) * 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnims[t.id], { toValue: 0, duration: 1300 + (i % 3) * 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      rot.start(); pulse.start();
      return [rot, pulse];
    });
    return () => loops.forEach(([r, p]) => { r.stop(); p.stop(); });
  }, [idKey]);

  useEffect(() => {
    (dismissingIds || []).forEach(id => {
      if (dismissAnims[id]) {
        Animated.timing(dismissAnims[id], { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }
    });
  }, [(dismissingIds || []).join(',')]);

  const colors = { high: C.red, medium: C.orange, low: C.pulse };
  const radii = [108, 128, 144, 120, 98, 132, 110, 138];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {tasks.slice(0, 8).map((t, i) => {
        const r = radii[i % radii.length];
        const startAngle = (i / Math.max(tasks.length, 1)) * 360;
        const size = 8 + (i % 3) * 3;
        const color = colors[t.priority] || C.pulse;
        const rotate = rotAnims[t.id]?.interpolate({ inputRange: [0, 1], outputRange: [`${startAngle}deg`, `${startAngle + 360}deg`] }) || '0deg';
        const pulseScale = pulseAnims[t.id]?.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) || 1;
        const pulseOpacity = pulseAnims[t.id]?.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) || 1;
        return (
          <Animated.View key={t.id} pointerEvents="box-none" style={{
            position: 'absolute', left: '50%', top: '50%', width: 0, height: 0,
            transform: [{ rotate }],
          }}>
            <Animated.View style={{
              position: 'absolute', left: r, top: -size / 2,
              opacity: dismissAnims[t.id], transform: [{ scale: dismissAnims[t.id] }],
            }}>
              <TouchableOpacity onPress={() => onTap(t)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Animated.View style={{
                  width: size, height: size, borderRadius: 2, backgroundColor: color,
                  opacity: pulseOpacity, transform: [{ scale: pulseScale }],
                  shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
                }} />
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        );
      })}
    </View>
  );
};

const HomePanel = ({ S, A }) => {
  const openToday = S.tasks.filter(t => t.date === today() && !t.done);
  const briefs = {
    Recharging: `Take it easy today, ${S.user.name}. You have ${openToday.length} things on deck — pick the one that matters most and let the rest wait. Energy comes back when you protect it.`,
    Steady: `${new Date().toLocaleDateString('en-US', { weekday: 'long' })} is ready for you, ${S.user.name}. You've got ${openToday.length} tasks today.`,
    'Locked In': `You're locked in, ${S.user.name}. ${openToday.length} tasks on deck and you're primed to move.`,
  };

  const insight = (() => {
    const open = S.tasks.filter(t => !t.done);
    const top = open.find(t => t.priority === 'high') || open[0];
    const connected = new Set(S.connections.flat());
    const isolated = S.nodes.filter(n => !connected.has(n.id));
    const overdue = S.tasks.filter(t => t.date < today() && !t.done);
    const topGoal = [...S.goals].sort((a, b) => b.progress - a.progress)[0];
    if (overdue.length > 0) return `${overdue.length} task${overdue.length > 1 ? 's' : ''} from earlier ${overdue.length > 1 ? 'are' : 'is'} still open — "${overdue[0].title}". Worth rescheduling or clearing before they pile up.`;
    if (isolated.length >= 2) return `${isolated.length} ideas in Space aren't connected to anything yet — "${isolated[0].title}" and "${isolated[1].title}" might belong together.`;
    if (S.user.vibe === 'Recharging' && top) return `Energy is low today. One thing done well beats five started. "${top.title}" is the move — just that, nothing else.`;
    if (S.user.vibe === 'Locked In' && top) return `You're locked in. "${top.title}" is where the leverage is right now — don't just work on it, try to finish it.`;
    if (top && topGoal) return `"${top.title}" connects directly to your "${topGoal.title}" goal at ${topGoal.progress}%. One clear outcome before you start cuts friction more than any system.`;
    return `Your calendar has room today. Use it to think in Space, not just fill it with tasks.`;
  })();

  const [popTask, setPopTask] = useState(null);
  const [dismissing, setDismissing] = useState([]);
  const completeWithAnimation = (id) => {
    setDismissing(d => [...d, id]);
    setTimeout(() => {
      A.toggleTask(id);
      setDismissing(d => d.filter(x => x !== id));
    }, 400);
  };
  const vibes = [
    { name: 'Recharging', icon: 'battery', color: C.orange },
    { name: 'Steady', icon: 'zap', color: C.drift },
    { name: 'Locked In', icon: 'flame', color: C.nova },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Vibe strip */}
        <View style={{ flexDirection: 'row', alignSelf: 'center', gap: 8, backgroundColor: 'rgba(5,6,15,0.85)', borderWidth: 1, borderColor: C.glassBorder, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginTop: 14 }}>
          {vibes.map(v => {
            const on = S.user.vibe === v.name;
            return (
              <TouchableOpacity key={v.name} onPress={() => A.setVibe(v.name)} style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999,
                backgroundColor: on ? v.color + '33' : 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: on ? v.color + '55' : 'rgba(255,255,255,0.1)',
              }}>
                <Icon name={v.icon} size={12} color={on ? v.color : '#a0a0c0'} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: on ? v.color : '#a0a0c0' }}>{v.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Coachmark id="home" style={{ marginHorizontal: 16, marginTop: 12 }} seen={S.seenCoachmarks?.home} onDismiss={() => A.dismissCoachmark('home')} />

        {/* Briefing — tap for the full Morning Brief */}
        <TouchableOpacity activeOpacity={0.8} onPress={A.openMorningBrief}>
          <Glass style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 14 }}>
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Kicker color={C.drift}>{CYCLE_META[currentCycle()].label}</Kicker>
                <Text style={{ fontSize: 10, color: C.muted }}>Open →</Text>
              </View>
              {S.quote ? (
                <View>
                  <Text style={{ fontSize: 12.5, color: '#c9c9dd', lineHeight: 20, fontStyle: 'italic' }}>"{S.quote.text}"</Text>
                  <Text style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>— {S.quote.author} · via zenquotes.io</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: C.muted, lineHeight: 19 }}>{briefs[S.user.vibe] || briefs.Steady}</Text>
              )}
              {S.weather && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                  <Icon name={S.weather.icon} size={13} color={C.muted} />
                  <Text style={{ fontSize: 11, color: C.muted }}>{S.weather.temp}°F · {S.weather.label} · H {S.weather.high}° L {S.weather.low}°</Text>
                </View>
              )}
            </View>
          </Glass>
        </TouchableOpacity>

        {/* Universe */}
        <View style={{ height: SH * 0.52, marginTop: 8 }}>
          {/* Orbit rings — slow independent drift */}
          {[[210, 70000, false], [300, 95000, true], [380, 120000, false]].map(([size, dur, reverse], i) => (
            <OrbitRing key={i} size={size} dur={dur} reverse={reverse} />
          ))}

          <OrbitAsteroids tasks={S.tasks.filter(t => !t.done)} onTap={setPopTask} dismissingIds={dismissing} />

          {/* User Core */}
          <TouchableOpacity onPress={() => A.setPanel('user')} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -70, marginTop: -70, width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1, borderColor: 'rgba(108,99,255,0.35)' }} />
            <Ship w={50} h={72} id="coreShip" tier={rankTier(S.user.xp)} />
            <View style={{ position: 'absolute', bottom: -34, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{S.user.name}</Text>
              <Text style={{ fontSize: 8, letterSpacing: 1.5, color: C.muted }}>USER CORE</Text>
            </View>
          </TouchableOpacity>

          {/* Planets */}
          {[
            { key: 'planning', label: 'Planning', sub: `${openToday.length} task${openToday.length !== 1 ? 's' : ''} today`, rgb: '101,167,255', iconName: 'calendar', pos: { left: '8%', top: '14%' }, badge: openToday.length, dur: 9000, dy: -7 },
            { key: 'focus', label: 'Focus', sub: 'Protect attention', rgb: '74,222,128', glyph: '◎', pos: { right: '7%', top: '12%' }, dur: 11000, dy: 7 },
            { key: 'space', label: 'Space', sub: `${S.nodes.length} ideas`, rgb: '167,139,250', glyph: '✦', pos: { left: '9%', bottom: '10%' }, badge: S.nodes.length, dur: 12000, dy: -5 },
          ].map(p => (
            <Floaty key={p.key} dur={p.dur} dy={p.dy} style={{ position: 'absolute', ...p.pos }}>
              <TouchableOpacity onPress={() => A.setPanel(p.key)} style={{ alignItems: 'center' }}>
                <View>
                  <View style={{
                    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: `rgba(${p.rgb},0.1)`, borderWidth: 1, borderColor: `rgba(${p.rgb},0.3)`,
                  }}>
                    {p.iconName ? <Icon name={p.iconName} size={22} color={`rgb(${p.rgb})`} /> : <Text style={{ fontSize: 24, color: `rgb(${p.rgb})` }}>{p.glyph}</Text>}
                  </View>
                  {p.badge != null && (
                    <View style={{
                      position: 'absolute', top: -2, right: -4, minWidth: 20, height: 20, borderRadius: 10,
                      backgroundColor: 'rgba(10,11,26,0.95)', borderWidth: 1, borderColor: `rgba(${p.rgb},0.5)`,
                      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: `rgb(${p.rgb})` }}>{p.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.text, marginTop: 8 }}>{p.label}</Text>
                <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{p.sub}</Text>
              </TouchableOpacity>
            </Floaty>
          ))}

          {/* Aibram companion orb — breathes, brightens when it's noticed something */}
          <Floaty dur={13000} dy={-5} style={{ position: 'absolute', left: '60%', top: '22%' }}>
            <TouchableOpacity onPress={() => A.setPanel('aibram')} style={{ alignItems: 'center' }}>
              <AibramOrb size={58} notice={S.aibramNotice} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.text, marginTop: 6 }}>Aibram</Text>
            </TouchableOpacity>
          </Floaty>
        </View>

        {/* Insight card */}
        <Glass style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 16 }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <PulseDot color={S.aibramNotice ? C.flare : C.pulse} />
              <Kicker style={{ marginBottom: 0 }}>Aibram Noticed</Kicker>
            </View>
            <Text style={{ fontSize: 12, color: C.muted, lineHeight: 19 }}>{S.observerInsight || insight}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => A.setPanel('focus')} style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.pulse }}>Start a focused session →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => A.setShowPaywall(true)}>
                <Text style={{ fontSize: 11, color: C.drift }}>✦ Plus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Glass>
      </ScrollView>

      {/* Asteroid task popup */}
      {popTask && (
        <View style={{ position: 'absolute', left: 20, right: 20, top: '30%', backgroundColor: 'rgba(10,11,26,0.97)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderTopWidth: 2, borderTopColor: { high: C.red, medium: C.orange, low: C.pulse }[popTask.priority] || C.pulse, borderRadius: 14, padding: 16, zIndex: 50 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: { high: C.red, medium: C.orange, low: C.pulse }[popTask.priority] || C.pulse, fontWeight: '700' }}>
              {{ high: 'High priority', medium: 'Medium priority', low: 'Low priority' }[popTask.priority] || 'Task'}
            </Text>
            <TouchableOpacity onPress={() => setPopTask(null)}><Text style={{ color: C.muted, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 5 }}>{popTask.title}</Text>
          <Text style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{popTask.project || 'No project'} · {popTask.time || 'No time set'} · {popTask.date === today() ? 'Today' : popTask.date}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => { completeWithAnimation(popTask.id); setPopTask(null); }} style={{ flex: 1, padding: 9, backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 9, alignItems: 'center' }}>
              <Text style={{ color: C.nova, fontSize: 12, fontWeight: '600' }}>✓ Mark done</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { A.setPanel('planning'); setPopTask(null); }} style={{ flex: 1, padding: 9, backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)', borderRadius: 9, alignItems: 'center' }}>
              <Text style={{ color: C.drift, fontSize: 12, fontWeight: '600' }}>Open Planning</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PLANNING — Calendar · Spending · ETA
// ═══════════════════════════════════════════════════════════════════════════
// TTL on cached ETAs — traffic conditions drift through the day, so a
// morning drive-time estimate shouldn't still apply if checked again at
// 4pm. 20 minutes balances freshness against not hammering the API on
// every re-render.
const ETA_TTL_MS = 20 * 60 * 1000;
const etaCache = {};
const LeaveByChip = ({ item, S }) => {
  const cached = etaCache[item.id];
  const isFresh = cached && (Date.now() - cached.fetchedAt) < ETA_TTL_MS;
  const [eta, setEta] = useState(() => (isFresh ? cached.result : undefined));
  const [loading, setLoading] = useState(!isFresh);

  useEffect(() => {
    const c = etaCache[item.id];
    if (c && (Date.now() - c.fetchedAt) < ETA_TTL_MS) {
      setEta(c.result);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const destination = item.location || item.title;
    fetchETA(S, destination).then(result => {
      etaCache[item.id] = { result, fetchedAt: Date.now() };
      if (!cancelled) { setEta(result); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [item.id, item.location, item.title, S.weather?.latitude, S.weather?.longitude]);

  if (loading) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
        <PulseDot color={C.muted} size={5} />
        <Text style={{ fontSize: 10, color: C.muted }}>Checking drive time...</Text>
      </View>
    );
  }

  if (!eta) {
    // No location, or an ungeocodable title — say so rather than just
    // showing nothing, so the feature stays discoverable.
    return item.kind === 'event' && !item.location ? (
      <Text style={{ fontSize: 10, color: C.muted, marginTop: 5, fontStyle: 'italic' }}>Add a location for a drive-time reminder</Text>
    ) : null;
  }

  const [h, m] = item.time.replace(/\s?[AP]M/i, '').split(':').map(Number);
  const isPM = /PM/i.test(item.time) && h !== 12;
  const eventMin = ((isPM ? h + 12 : h) * 60) + (m || 0);
  const leaveMin = eventMin - eta.durationMin - 5;
  if (leaveMin <= 0) return null;
  const lh = Math.floor(leaveMin / 60), lm = leaveMin % 60;
  const leaveStr = `${lh > 12 ? lh - 12 : lh || 12}:${String(lm).padStart(2, '0')} ${lh >= 12 ? 'PM' : 'AM'}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(108,99,255,0.08)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
      <Icon name="clock" size={11} color={C.drift} />
      <Text style={{ fontSize: 10, color: C.drift }}>Leave by {leaveStr} · ~{eta.durationMin} min drive{eta.distanceText ? ` (${eta.distanceText})` : ''}</Text>
    </View>
  );
};

const PlanningPanel = ({ S, A }) => {
  const [tab, setTab] = useState('calendar');
  const [calMonth, setCalMonth] = useState(new Date());
  const [quickAdd, setQuickAdd] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const [editItem, setEditItem] = useState(null);
  const [quickAddPriority, setQuickAddPriority] = useState('low');
  const [quickAddTime, setQuickAddTime] = useState('');
  const [calView, setCalView] = useState('month');
  const [projFilter, setProjFilter] = useState(null);

  const agendaItemsAll = [
    ...S.events.filter(e => e.date === S.selectedDate).map(e => ({ ...e, kind: 'event' })),
    ...S.tasks.filter(t => t.date === S.selectedDate).map(t => ({ ...t, kind: 'task' })),
  ].sort((a, b) => parseTime(a.time) - parseTime(b.time));
  const agendaItems = projFilter ? agendaItemsAll.filter(i => (i.project || (i.kind === 'event' ? 'Events' : '')) === projFilter) : agendaItemsAll;
  const projectsPresent = [...new Set(agendaItemsAll.map(i => i.project || (i.kind === 'event' ? 'Events' : null)).filter(Boolean))];

  const conflictIds = (() => {
    const timed = agendaItemsAll.filter(i => i.time && !i.done);
    const ids = new Set();
    for (let a = 0; a < timed.length; a++) for (let b = a + 1; b < timed.length; b++) {
      if (Math.abs(parseTime(timed[a].time) - parseTime(timed[b].time)) < 45) { ids.add(timed[a].id); ids.add(timed[b].id); }
    }
    return ids;
  })();

  const weekDates = (() => {
    const sel = new Date(S.selectedDate + 'T00:00:00');
    const start = new Date(sel); start.setDate(sel.getDate() - sel.getDay());
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d.toISOString().split('T')[0]; });
  })();

  const spendStart = (() => { const now = new Date(); const s = new Date(now); s.setDate(now.getDate() - now.getDay()); return s.toISOString().split('T')[0]; })();
  const byCat = {};
  SPEND_CATS.forEach(c => byCat[c] = 0);
  S.transactions.forEach(t => { if (t.date >= spendStart && t.date <= today()) byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const totalSpend = Object.values(byCat).reduce((a, b) => a + b, 0);
  const totalBudget = Object.values(S.budgets).reduce((a, b) => a + b.limit, 0);
  const overBudget = Object.entries(byCat).filter(([cat, amt]) => amt > (S.budgets[cat]?.limit || 999));
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const spendInsight = (() => {
    if (overBudget.length > 0) {
      const [cat, spent] = overBudget[0];
      return `You're $${(spent - S.budgets[cat].limit).toFixed(2)} over your ${cat} budget. That's the one to watch right now — small daily decisions in that category add up faster than they feel like they should.`;
    }
    if (totalSpend > totalBudget * 0.8) return `You've used ${Math.round((totalSpend / totalBudget) * 100)}% of your total budget and the week isn't over. You're still within limits, but the next few days will decide whether it stays that way.`;
    if (topCat && topCat[1] > 0) return `Your biggest spend this week is ${topCat[0]} at $${topCat[1].toFixed(2)}. Overall you're at $${totalSpend.toFixed(2)} of $${totalBudget} — you've got $${(totalBudget - totalSpend).toFixed(2)} left to work with.`;
    return `No spending logged yet this week. Track as you go — even rough estimates help you see the pattern.`;
  })();

  const TabBtn = ({ id, label, iconName }) => (
    <TouchableOpacity onPress={() => setTab(id)} style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 2,
      borderBottomColor: tab === id ? C.pulse : 'transparent',
    }}>
      {iconName && <Icon name={iconName} size={13} color={tab === id ? C.drift : C.muted} />}
      <Text style={{ fontSize: 13, fontWeight: '600', color: tab === id ? C.drift : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );

  const trafficColors = { light: C.nova, moderate: C.orange, heavy: C.red };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <Kicker>Planning</Kicker>
        <Text style={{ fontSize: 24, fontWeight: '700', color: C.text, letterSpacing: -0.5 }}>Plan your days.</Text>
        <View style={{ flexDirection: 'row', marginTop: 12, borderBottomWidth: 1, borderBottomColor: C.glassBorder }}>
          <TabBtn id="calendar" iconName="calendar" label="Calendar" />
          <TabBtn id="spending" iconName="card" label="Spending" />
        </View>
      </View>

      <Coachmark id="planning" seen={S.seenCoachmarks?.planning} onDismiss={() => A.dismissCoachmark('planning')} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        {tab === 'calendar' && (<>
          <Glass style={{ marginBottom: 14 }}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setCalMonth(new Date(year, month - 1, 1))} style={st.calNavBtn}><Text style={{ color: C.muted }}>‹</Text></TouchableOpacity>
                <Text style={{ fontSize: 12, letterSpacing: 1.5, color: C.text, fontWeight: '600' }}>{calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</Text>
                <TouchableOpacity onPress={() => setCalMonth(new Date(year, month + 1, 1))} style={st.calNavBtn}><Text style={{ color: C.muted }}>›</Text></TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 2, gap: 2, marginBottom: 10 }}>
                {[['month', 'Month'], ['week', 'Week']].map(([id, label]) => (
                  <TouchableOpacity key={id} onPress={() => setCalView(id)} style={{ paddingVertical: 4, paddingHorizontal: 14, borderRadius: 7, backgroundColor: calView === id ? 'rgba(108,99,255,0.18)' : 'transparent' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: calView === id ? C.drift : C.muted }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row' }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <Text key={i} style={{ width: '14.28%', textAlign: 'center', fontSize: 9, color: C.muted, paddingVertical: 4 }}>{d}</Text>
                ))}
              </View>
              {calView === 'week' ? (
                <View style={{ flexDirection: 'row' }}>
                  {weekDates.map((ds, i) => {
                    const isToday = ds === today();
                    const isSel = ds === S.selectedDate;
                    const dayItems = [...S.tasks, ...S.events].filter(t => t.date === ds);
                    return (
                      <TouchableOpacity key={i} onPress={() => A.setSelectedDate(ds)} style={{
                        width: '14.28%', paddingVertical: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                        borderColor: isToday && !isSel ? 'rgba(108,99,255,0.4)' : 'transparent',
                        backgroundColor: isSel ? C.pulse : 'transparent',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSel ? '#fff' : isToday ? C.drift : C.text }}>{Number(ds.split('-')[2])}</Text>
                        <View style={{ flexDirection: 'row', gap: 2, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 30 }}>
                          {dayItems.slice(0, 4).map((it, j) => (
                            <View key={j} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSel ? '#fff' : it.kind === 'event' || !it.priority ? C.drift : { high: C.red, medium: C.orange, low: C.pulse }[it.priority] }} />
                          ))}
                        </View>
                        <Text style={{ fontSize: 8, color: isSel ? 'rgba(255,255,255,0.8)' : C.muted, marginTop: 3 }}>{dayItems.length > 0 ? dayItems.length : ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {cells.map((d, i) => {
                  if (d === null) return <View key={i} style={{ width: '14.28%', aspectRatio: 1 }} />;
                  const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const isToday = ds === today();
                  const isSel = ds === S.selectedDate;
                  const hasTasks = [...S.tasks, ...S.events].some(t => t.date === ds);
                  return (
                    <TouchableOpacity key={i} onPress={() => A.setSelectedDate(ds)} style={{
                      width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 8, borderWidth: 1,
                      borderColor: isToday && !isSel ? 'rgba(108,99,255,0.4)' : 'transparent',
                      backgroundColor: isSel ? C.pulse : 'transparent',
                    }}>
                      <Text style={{ fontSize: 12, color: isSel ? '#fff' : isToday ? C.drift : C.muted }}>{d}</Text>
                      {hasTasks && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSel ? '#fff' : isToday ? C.drift : C.pulse, marginTop: 2, opacity: isSel ? 1 : 0.95 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              )}
            </View>
          </Glass>

          <Glass>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.glassBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Kicker color={C.muted}>Daily Agenda</Kicker>
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>{S.selectedDate === today() ? 'Today' : fmtDate(S.selectedDate, { weekday: 'long' })}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQuickAdd(v => !v)} style={{ backgroundColor: C.pulse, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {projectsPresent.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 14, paddingTop: 10 }} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity onPress={() => setProjFilter(null)} style={{ paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: !projFilter ? 'rgba(108,99,255,0.45)' : C.glassBorder, backgroundColor: !projFilter ? 'rgba(108,99,255,0.12)' : 'transparent' }}>
                  <Text style={{ fontSize: 10.5, color: !projFilter ? C.drift : C.muted }}>All</Text>
                </TouchableOpacity>
                {projectsPresent.map(p => (
                  <TouchableOpacity key={p} onPress={() => setProjFilter(projFilter === p ? null : p)} style={{ paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: projFilter === p ? 'rgba(108,99,255,0.45)' : C.glassBorder, backgroundColor: projFilter === p ? 'rgba(108,99,255,0.12)' : 'transparent' }}>
                    <Text style={{ fontSize: 10.5, color: projFilter === p ? C.drift : C.muted }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={{ padding: 14, gap: 8 }}>
              {agendaItems.length === 0 && (
                <View style={{ alignItems: 'center', padding: 24 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>Open space</Text>
                  <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 19 }}>This day has room. You don't need to fill it unless something meaningful belongs here.</Text>
                </View>
              )}
              {agendaItems.map(item => {
                const colors = { high: C.red, medium: C.orange, low: C.pulse };
                const color = item.kind === 'event' ? C.drift : colors[item.priority] || C.pulse;
                const conflicted = conflictIds.has(item.id);
                return (
                  <TouchableOpacity key={item.id} activeOpacity={0.75} onPress={() => setEditItem(item)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: conflicted ? 'rgba(244,113,113,0.4)' : C.glassBorder, borderRadius: 12, opacity: item.done ? 0.45 : 1 }}>
                    <Text style={{ fontSize: 10, color: C.muted, width: 54, paddingTop: 2 }}>{item.time || 'Anytime'}</Text>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 4 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{item.title}</Text>
                      <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.project || ''}{item.kind === 'event' ? ' · Event' : ''}{item.recurring ? ' · Weekly' : ''}</Text>
                      {conflicted && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(244,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(244,113,113,0.25)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
                          <Icon name="warning" size={10} color={C.red} />
                          <Text style={{ fontSize: 9.5, color: C.red }}>Overlaps another commitment</Text>
                        </View>
                      )}
                      {item.time && item.kind === 'event' && <LeaveByChip item={item} S={S} />}
                    </View>
                    {item.kind === 'task' ? (
                      <TouchableOpacity onPress={() => A.toggleTask(item.id)} style={{
                        width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
                        borderColor: item.done ? 'rgba(74,222,128,0.4)' : C.glassBorder,
                        backgroundColor: item.done ? 'rgba(74,222,128,0.15)' : 'transparent',
                      }}>
                        <Text style={{ color: item.done ? C.nova : C.muted, fontSize: 12 }}>{item.done ? '✓' : '○'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 10, color: C.muted, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 6 }}>Event</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {showQuickAdd && (
              <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: C.glassBorder }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    value={quickAdd} onChangeText={setQuickAdd} placeholder="Add a commitment..." placeholderTextColor={C.muted}
                    onSubmitEditing={() => { if (quickAdd.trim()) { A.addTask(quickAdd.trim(), { priority: quickAddPriority, time: quickAddTime.trim() || null }); setQuickAdd(''); setQuickAddTime(''); } }}
                    style={{ flex: 1, color: C.text, fontSize: 13, paddingVertical: 6 }}
                  />
                  <TouchableOpacity onPress={() => { if (quickAdd.trim()) { A.addTask(quickAdd.trim(), { priority: quickAddPriority, time: quickAddTime.trim() || null }); setQuickAdd(''); setQuickAddTime(''); } }} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.pulse, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 18 }}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' }}>
                  {['low', 'medium', 'high'].map(p => (
                    <TouchableOpacity key={p} onPress={() => setQuickAddPriority(p)} style={{ paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: quickAddPriority === p ? 'rgba(108,99,255,0.5)' : C.glassBorder, backgroundColor: quickAddPriority === p ? 'rgba(108,99,255,0.12)' : 'transparent' }}>
                      <Text style={{ fontSize: 10.5, color: quickAddPriority === p ? C.drift : C.muted, textTransform: 'capitalize' }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput value={quickAddTime} onChangeText={setQuickAddTime} placeholder="Time (opt.)" placeholderTextColor={C.muted} style={{ flex: 1, color: C.text, fontSize: 11.5, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 999 }} />
                </View>
              </View>
            )}
          </Glass>

          <View style={st.aiInsight}>
            <Text style={st.aiInsightLabel}>✦ PLANNING INSIGHT</Text>
            <Text style={st.aiInsightText}>You have a clear window this morning. It's long enough for meaningful progress on your most important task.</Text>
          </View>
        </>)}

        {editItem && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <View style={{ backgroundColor: '#0d0e20', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: C.glassHi }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Kicker color={C.drift}>{editItem.kind === 'event' ? 'Edit event' : 'Edit commitment'}</Kicker>
                  <TouchableOpacity onPress={() => setEditItem(null)} style={{ padding: 6 }}><Text style={{ color: C.muted, fontSize: 15 }}>✕</Text></TouchableOpacity>
                </View>
                <Text style={{ fontSize: 10, color: C.muted, marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>Title</Text>
                <TextInput value={editItem.title} onChangeText={v => setEditItem(e => ({ ...e, title: v }))} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12, padding: 12, color: C.text, fontSize: 14, marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: C.muted, marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>Date</Text>
                    <TextInput value={editItem.date} onChangeText={v => setEditItem(e => ({ ...e, date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12, padding: 12, color: C.text, fontSize: 13 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: C.muted, marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>Time</Text>
                    <TextInput value={editItem.time || ''} onChangeText={v => setEditItem(e => ({ ...e, time: v || null }))} placeholder="e.g. 3:00 PM" placeholderTextColor={C.muted} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12, padding: 12, color: C.text, fontSize: 13 }} />
                  </View>
                </View>
                {editItem.kind === 'event' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, color: C.muted, marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>Location (optional)</Text>
                    <TextInput
                      value={editItem.location || ''} onChangeText={v => setEditItem(e => ({ ...e, location: v || null }))}
                      placeholder="e.g. a restaurant name, or a campus building" placeholderTextColor={C.muted}
                      style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12, padding: 12, color: C.text, fontSize: 13 }}
                    />
                    <Text style={{ fontSize: 10, color: C.muted, marginTop: 6, lineHeight: 14 }}>Powers a real "leave by" drive-time reminder when it can be found. Leave blank and the event title is used instead.</Text>
                  </View>
                )}
                {editItem.kind === 'task' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, color: C.muted, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>Priority</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['low', 'medium', 'high'].map(p => (
                        <TouchableOpacity key={p} onPress={() => setEditItem(e => ({ ...e, priority: p }))} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: editItem.priority === p ? 'rgba(108,99,255,0.5)' : C.glassBorder, backgroundColor: editItem.priority === p ? 'rgba(108,99,255,0.12)' : 'transparent' }}>
                          <Text style={{ fontSize: 12, color: editItem.priority === p ? C.drift : C.muted, textTransform: 'capitalize' }}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => {
                    if (editItem.kind === 'event') A.deleteEvent(editItem.id); else A.deleteTask(editItem.id);
                    setEditItem(null);
                  }} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244,113,113,0.35)', alignItems: 'center' }}>
                    <Icon name="trash" size={15} color={C.red} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    const patch = { title: editItem.title.trim() || 'Untitled', date: editItem.date, time: editItem.time };
                    if (editItem.kind === 'event') A.updateEvent(editItem.id, { ...patch, location: editItem.location || null });
                    else A.updateTask(editItem.id, { ...patch, priority: editItem.priority });
                    setEditItem(null); A.toast('Saved.');
                  }} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: C.pulse, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Save changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {tab === 'spending' && (<>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Total spent', value: `$${totalSpend.toFixed(2)}`, sub: 'This week', color: C.text, onPress: null },
              { label: 'Budget remaining', value: `$${Math.max(0, totalBudget - totalSpend).toFixed(2)}`, sub: `of $${totalBudget} budget · tap to edit`, color: totalSpend > totalBudget ? C.red : C.nova, onPress: () => A.openModal('budgets') },
              { label: 'Transactions', value: String(S.transactions.filter(t => t.date >= spendStart).length), sub: 'this period', color: C.drift, onPress: null },
              { label: 'Over budget', value: String(overBudget.length), sub: overBudget.length > 0 ? overBudget.map(([c]) => c).join(', ') : 'All within limits', color: overBudget.length > 0 ? C.red : C.nova, onPress: null },
            ].map(s => {
              const Card = s.onPress ? TouchableOpacity : View;
              return (
                <Card key={s.label} onPress={s.onPress} style={{ width: '48%', flexGrow: 1 }}>
                  <Glass style={{ padding: 14 }}>
                    <Kicker color={C.muted}>{s.label}</Kicker>
                    <Text style={{ fontSize: 21, fontWeight: '700', color: s.color }}>{s.value}</Text>
                    <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.sub}</Text>
                  </Glass>
                </Card>
              );
            })}
          </View>

          <Glass style={{ marginBottom: 14 }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.glassBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>Budget vs Actual</Text>
              <TouchableOpacity onPress={() => A.openModal('budgets')} style={{ backgroundColor: 'rgba(108,99,255,0.12)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 11, color: C.drift, fontWeight: '600' }}>Edit budgets</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              {Object.entries(S.budgets).map(([cat, b]) => {
                const spent = byCat[cat] || 0;
                const pct = Math.min(100, (spent / b.limit) * 100);
                const over = spent > b.limit;
                const barColor = pct > 90 ? C.red : pct > 70 ? C.orange : C.nova;
                return (
                  <View key={cat} style={{ marginBottom: 13 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={b.icon} size={14} color={C.text} /><Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{cat}</Text></View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, color: over ? C.red : C.muted }}>${spent.toFixed(2)} / ${b.limit}</Text>
                        {over && <Icon name="warning" size={11} color={C.red} />}
                      </View>
                    </View>
                    <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                      <View style={{ height: 6, width: `${pct}%`, backgroundColor: barColor, borderRadius: 3 }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </Glass>

          <Glass style={{ marginBottom: 14 }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.glassBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>Transactions</Text>
              <TouchableOpacity onPress={() => A.openModal('addSpend')} style={{ backgroundColor: C.pulse, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {[...S.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(t => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={t.icon} size={15} color={C.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{t.note}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{t.category} · {t.date === today() ? 'Today' : t.date === addDays(-1) ? 'Yesterday' : t.date}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>-${t.amount.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => A.deleteTransaction(t.id)}><Text style={{ color: C.muted, fontSize: 13 }}>✕</Text></TouchableOpacity>
              </View>
            ))}
          </Glass>

          <View style={st.aiInsight}>
            <Text style={st.aiInsightLabel}>✦ AIBRAM ON YOUR SPENDING</Text>
            <Text style={st.aiInsightText}>{spendInsight}</Text>
          </View>
        </>)}

      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// AIBRAM AI — chat with full cross-tab context
// ═══════════════════════════════════════════════════════════════════════════
const AIBRAM_TOOLS = [
  {
    name: 'add_task',
    description: "Add a commitment/task to the person's Planning list. Use when they ask you to add, remember, note, or track a to-do.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, clear task title.' },
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today if omitted.' },
        time: { type: 'string', description: "Optional clock time, e.g. '3:00 PM'." },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_event',
    description: 'Schedule a calendar event at a specific date and time. Use when they ask to schedule, book, or put something on the calendar.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD, required.' },
        time: { type: 'string', description: "e.g. '3:00 PM', required." },
        repeat_weekly: { type: 'boolean', description: 'True if this should repeat every week (e.g. a class or standing meeting). Creates 8 weekly occurrences.' },
        location: { type: 'string', description: 'Optional real place name or address (e.g. "Chili\'s on Parmer Ln" or a campus building). Enables a real drive-time "leave by" reminder. Only include if the person actually mentioned a place.' },
      },
      required: ['title', 'date', 'time'],
    },
  },
  {
    name: 'add_node',
    description: "Save an idea, question, principle, goal, project, or story to the person's Space (their thinking graph). Use when they explicitly ask you to save or capture a thought there.",
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['idea', 'question', 'principle', 'goal', 'project', 'story'] },
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['type', 'title', 'body'],
    },
  },
];

const buildLiveContext = (S) => {
  const now = new Date();
  const todayStr = today();
  const todayTasks = S.tasks.filter(t => t.date === todayStr);
  const doneTasks = todayTasks.filter(t => t.done);
  const openTasks = todayTasks.filter(t => !t.done);
  const overdueTasks = S.tasks.filter(t => t.date < todayStr && !t.done);
  const upcomingTasks = S.tasks.filter(t => t.date > todayStr && !t.done).slice(0, 5);
  const highPriority = openTasks.filter(t => t.priority === 'high');

  const spaceByType = {};
  S.nodes.forEach(n => { if (!spaceByType[n.type]) spaceByType[n.type] = []; spaceByType[n.type].push(n.title); });
  const spaceConnections = S.connections.map(([a, b]) => {
    const na = S.nodes.find(n => n.id === a), nb = S.nodes.find(n => n.id === b);
    return na && nb ? `"${na.title}" and "${nb.title}"` : null;
  }).filter(Boolean);
  const connectedIds = new Set(S.connections.flat());
  const isolatedNodes = S.nodes.filter(n => !connectedIds.has(n.id)).map(n => n.title);

  const spendStart = (() => { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - n.getDay()); return s.toISOString().split('T')[0]; })();
  const byCat = {};
  S.transactions.forEach(t => { if (t.date >= spendStart) byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const totalSpend = Object.values(byCat).reduce((a, b) => a + b, 0);
  const totalBudget = Object.values(S.budgets).reduce((a, b) => a + b.limit, 0);
  const overBudget = Object.entries(byCat).filter(([cat, amt]) => amt > (S.budgets[cat]?.limit || 999));

  return `
═══════════════════════════════════════
LIVE USER CONTEXT — ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} (ISO: ${todayStr})
Everything you need to know about where ${S.user.name} stands RIGHT NOW.
═══════════════════════════════════════

IDENTITY & ENERGY:
- Name: ${S.user.name}
- Age bracket: ${S.user.ageBracket || 'not shared'} (tailor advice to this life stage — a teen's priorities differ from a 40-year-old's)
- Vibe today: ${S.user.vibe} ${S.user.vibe === 'Recharging' ? "(low energy — be gentle, don't pile on)" : S.user.vibe === 'Locked In' ? '(high energy — be direct, push further)' : '(normal — your natural register)'}
- XP: ${S.user.xp} (${getXPRank(S.user.xp).name} rank)
- Streak: ${S.user.streak} days

TODAY'S PLANNING (${todayStr}):
- Done: ${doneTasks.length}/${todayTasks.length} tasks
- Open tasks (${openTasks.length}): ${openTasks.map(t => `"${t.title}" [${t.priority}${t.time ? ' · ' + t.time : ''}]`).join(', ') || 'none'}
- High priority right now: ${highPriority.map(t => `"${t.title}"`).join(', ') || 'none'}
- Overdue (${overdueTasks.length}): ${overdueTasks.slice(0, 3).map(t => `"${t.title}"`).join(', ') || 'none'}
- Coming up: ${upcomingTasks.map(t => `"${t.title}" (${t.date})`).join(', ') || 'nothing scheduled'}

SPACE — WHAT'S ON THEIR MIND (${S.nodes.length} nodes):
${Object.entries(spaceByType).map(([type, titles]) => `- ${type}s: ${titles.join(', ')}`).join('\n') || '- Space is empty'}
- Connections established: ${spaceConnections.slice(0, 6).join(' | ') || 'none yet'}
- Isolated nodes: ${isolatedNodes.join(', ') || 'none — all connected'}

LONG-TERM GOALS:
${S.goals.map(g => `- ${g.title} [${g.progress}% · ${g.momentum}]`).join('\n')}

ACTIVE PROJECTS:
${S.projects.map(p => `- ${p.title}: ${p.progress}% complete, next: "${p.next}"`).join('\n')}

TIMELINE — RECENT WINS:
${S.timeline.slice(0, 3).map(s => `- "${s.title}" (${s.chapter})`).join('\n')}

FOCUS:
- ${S.focusSessions > 0 ? `${S.focusSessions} focus sessions completed, ${S.focusMinutes} total minutes` : 'No focus sessions yet'}

SPENDING & BUDGET (week):
- Total spent: $${totalSpend.toFixed(2)} of $${totalBudget} budget
- Over budget: ${overBudget.length > 0 ? overBudget.map(([c, a]) => `${c} ($${(a - S.budgets[c].limit).toFixed(2)} over)`).join(', ') : 'none'}
═══════════════════════════════════════`;
};

const buildSystemPrompt = (S, actionsEnabled = false) => `You are Aibram — not an assistant, not a chatbot. A presence. The AI partner at the center of a Life OS called Aibram, designed to help people turn their ambitions into the life they said they wanted to live.

You are a partner — someone to do life with. The wisdom of someone older, the energy of someone younger. Ageless.

PERSONALITY:
Calm, direct, warm, occasionally dry. Never perform enthusiasm. No "Absolutely!", "Great question!", "Of course!" Lead with the point. Match the user's energy. Short sentences under pressure. One question at a time. Specific not generic — reference what you actually know about ${S.user.name}.

VOICE BY VIBE:
- Recharging: Gentler. Shorter. Less pressure. Don't pile on.
- Steady: Your natural register. Collaborative, warm, engaged.
- Locked In: Efficient. Direct. Support the momentum.

WHAT YOU NEVER DO:
Never sarcasm. Never guilt-trip. Never fake certainty — say "I don't know" when uncertain. Never lecture more than once. Never make ambition sound like a problem. Never make yourself the center.

CROSS-TAB INTELLIGENCE — YOU KNOW ALL OF THIS RIGHT NOW:
${buildLiveContext(S)}

HOW TO USE THIS KNOWLEDGE:
- Reference specific tasks, nodes, and goals by name without being asked
- Connect dots between tabs; surface what's important
- When someone asks what to work on, you already know — don't ask, answer
- When tasks are overdue, gently surface them — once, with care

RESPONSE STYLE:
Conversational. 2-4 sentences for most things. Longer only when genuinely needed. No bullet lists unless essential. No markdown headers. Talk like someone who has been paying attention all along — because you have.
Never use markdown formatting of any kind — no **bold**, no _italic_, no # headers, no bullet dashes. This app renders your text as plain text, not markdown, so any of those symbols show up as literal stray characters on screen. Write everything in plain sentences instead — use word choice and structure for emphasis, not symbols.

SHOWING YOUR WORK:
You can render real step-by-step work and real charts, not just describe them in prose — use these when they genuinely help, not for every reply.
- Math, calculations, or any problem with a sequence of steps: after your normal short reply, append a fenced block exactly like this (valid JSON, no comments, no trailing commas):
\`\`\`aibram-steps
{"title": "short title", "steps": [{"label": "Step 1", "text": "what happens in this step"}, {"label": "Step 2", "text": "..."}], "result": "the final answer, short"}
\`\`\`
- Comparisons, spending breakdowns, or planning data that's clearer as a chart: append a fenced block exactly like this:
\`\`\`aibram-chart
{"title": "short title", "type": "bar", "labels": ["Label A", "Label B"], "values": [12.5, 34], "unit": "$"}
\`\`\`
Only include a block when it adds real clarity — most replies need neither. Never show the raw JSON or the fence markers as visible text; the app renders them into a real card and strips the block automatically. At most one block per reply.
${S.isPlus ? `
DURABLE MEMORY:
This person has Aibram+, which means what you learn about them compounds — it isn't limited to this session's chat history. Facts you already know about them long-term:
${S.memoryFacts && S.memoryFacts.length > 0 ? S.memoryFacts.map(f => `- ${f}`).join('\n') : '- Nothing saved yet — this is early.'}
When something durable and worth remembering *long-term* comes up — a stated preference, a life fact, a decision, a milestone, something that would still be true and useful to know weeks from now — silently append a block:
\`\`\`aibram-memory
{"facts": ["short durable fact, third person, e.g. 'Prefers direct answers over lengthy explanations'"]}
\`\`\`
Only include facts that are NEW — never repeat something already in the list above. Do not save situational or transient things (today's mood, what they're doing right now, a passing question). Most replies won't need this block at all.` : ''}
${actionsEnabled ? `
TAKING ACTION:
You have tools to actually add tasks, schedule events, and save ideas to Space — not just talk about doing it. When someone asks you to schedule, add, remember, or save something concrete, use the matching tool instead of just describing what you'd do. Compute real dates from the ISO date above (e.g. "Thursday" → the next actual Thursday's YYYY-MM-DD). The app will always show the person your proposed action and ask them to confirm before anything changes — so propose confidently, you're not the one who finalizes it. Keep any accompanying text short; the action card speaks for itself. Only use a tool when the person is asking for something to actually happen, not when they're just thinking out loud or asking a hypothetical.` : ''}`;

const WEATHER_LABELS = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

async function fetchWeather() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = loc.coords;
    let city = null;
    try {
      const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        city = geo.city || geo.locality || null;
        if (city && geo.principalSubdivisionCode) city = `${city}, ${geo.principalSubdivisionCode.split('-').pop()}`;
      }
    } catch (e) { /* city stays null */ }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data.current?.weather_code ?? 0;
    const label = WEATHER_LABELS[code] || '—';
    const icon = WEATHER_ICON_BY_CODE[code] || 'thermometer';
    return {
      temp: Math.round(data.current?.temperature_2m ?? 0),
      high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
      low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
      label, icon, city, latitude, longitude,
    };
  } catch (e) {
    console.log('Weather fetch failed:', e);
    return null;
  }
}

async function fetchQuoteOfDay() {
  try {
    const res = await fetch('https://zenquotes.io/api/today');
    if (!res.ok) return null;
    const data = await res.json();
    const q = Array.isArray(data) ? data[0] : null;
    if (!q || !q.q) return null;
    return { text: q.q, author: q.a || 'Unknown' };
  } catch (e) {
    console.log('Quote fetch failed:', e);
    return null;
  }
}

let LAST_AI_ERROR = null;
const setAIError = (msg) => { LAST_AI_ERROR = msg; if (msg) console.log('[Aibram AI]', msg); };

async function getIdToken() {
  try {
    const user = auth.currentUser;
    if (!user) { setAIError('Not signed in — no auth token to send.'); return null; }
    return await user.getIdToken(true);
  } catch (e) {
    setAIError(`Auth token failed: ${e?.code || e?.message || 'unknown'} — try signing out and back in.`);
    return null;
  }
}

function offlineFallbackReply(S, userMessage) {
  const open = S.tasks.filter(t => t.date === today() && !t.done);
  const top = open.find(t => t.priority === 'high') || open[0];
  const lower = userMessage.toLowerCase();
  if (lower.includes('focus') || lower.includes('work on')) {
    return top ? `"${top.title}" is the clearest priority — it connects directly to your biggest goal right now. Define one visible outcome before you start, then protect ${S.user.vibe === 'Recharging' ? '25' : '45'} minutes for it.` : `Your day is open. That's rare — use it to think, not just fill it.`;
  }
  if (lower.includes('plan')) {
    return open.length > 0
      ? `You've got ${open.length} open task${open.length !== 1 ? 's' : ''} today${top ? `, starting with "${top.title}"` : ''}. One clear priority beats a long list.`
      : `Your day is open. Use it deliberately, or just rest — both are valid.`;
  }
  if (lower.includes('motivat')) {
    return `You're ${S.user.streak} days into a streak and ${getXPRank(S.user.xp).name} rank. Whatever you're building gets built in sessions like the one you could start right now.`;
  }
  if (lower.includes('briefing') || lower.includes('morning')) {
    return `${new Date().toLocaleDateString('en-US', { weekday: 'long' })}. ${open.length > 0 ? `${open.length} task${open.length !== 1 ? 's' : ''} on deck${top ? `, "${top.title}" leads` : ''}.` : `Nothing on the calendar yet — a clean slate.`}`;
  }
  return `I hear you. ${top ? `For what it's worth, "${top.title}" is still the highest-leverage thing on your plate today — but tell me more about what's actually on your mind.` : `What's actually on your mind?`}`;
}

function stripMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .trim();
}

function parseAibramBlocks(text) {
  if (!text) return { cleanText: text, steps: null, chart: null, memoryFacts: null };
  let cleanText = text;
  let steps = null;
  let chart = null;
  let memoryFacts = null;

  const stepsMatch = text.match(/```aibram-steps\s*([\s\S]*?)```/);
  if (stepsMatch) {
    try {
      const parsed = JSON.parse(stepsMatch[1].trim());
      if (parsed && Array.isArray(parsed.steps)) {
        steps = {
          ...parsed,
          title: stripMarkdown(parsed.title),
          result: stripMarkdown(parsed.result),
          steps: parsed.steps.map(s => ({ ...s, label: stripMarkdown(s.label), text: stripMarkdown(s.text) })),
        };
      }
    } catch (e) { /* malformed block — just drop it, don't crash the chat */ }
    cleanText = cleanText.replace(stepsMatch[0], '').trim();
  }

  const chartMatch = text.match(/```aibram-chart\s*([\s\S]*?)```/);
  if (chartMatch) {
    try {
      const parsed = JSON.parse(chartMatch[1].trim());
      if (parsed && Array.isArray(parsed.labels) && Array.isArray(parsed.values)) chart = { ...parsed, title: stripMarkdown(parsed.title) };
    } catch (e) { /* malformed block — just drop it */ }
    cleanText = cleanText.replace(chartMatch[0], '').trim();
  }

  const memoryMatch = text.match(/```aibram-memory\s*([\s\S]*?)```/);
  if (memoryMatch) {
    try {
      const parsed = JSON.parse(memoryMatch[1].trim());
      if (parsed && Array.isArray(parsed.facts) && parsed.facts.length > 0) memoryFacts = parsed.facts;
    } catch (e) { /* malformed block — just drop it */ }
    cleanText = cleanText.replace(memoryMatch[0], '').trim();
  }

  return { cleanText: stripMarkdown(cleanText), steps, chart, memoryFacts };
}

function buildCleanHistory(chatHistory) {
  const out = [];
  let i = 0;
  while (i < chatHistory.length) {
    const m = chatHistory[i];
    if (m.role === 'user' || m.role === 'assistant') {
      out.push({ role: m.role, content: m.content });
      i++;
    } else if (m.role === 'action') {
      const turnId = m.turnId;
      const group = [];
      while (i < chatHistory.length && chatHistory[i].role === 'action' && chatHistory[i].turnId === turnId) {
        group.push(chatHistory[i]);
        i++;
      }
      if (group[0]?.rawContent) {
        out.push({ role: 'assistant', content: group[0].rawContent });
        out.push({
          role: 'user',
          content: group.map(a => ({
            type: 'tool_result',
            tool_use_id: a.toolUseId,
            content: a.status === 'approved'
              ? 'Approved and completed — this is already done. Do not propose it again.'
              : a.status === 'declined'
              ? 'The person declined this action. Do not propose the same thing again unless they ask again.'
              : 'Still waiting on the person to confirm — not decided yet.',
          })),
        });
      }
    } else {
      i++;
    }
  }
  return out;
}

function buildFinalContent(userMessage, attachment) {
  return attachment
    ? [
        attachment.mime === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: attachment.base64 } }
          : { type: 'image', source: { type: 'base64', media_type: attachment.mime, data: attachment.base64 } },
        { type: 'text', text: userMessage },
      ]
    : userMessage;
}

async function callAI(S, chatHistory, userMessage, attachment = null) {
  try {
    if (!AIBRAM_FUNCTION_URL) throw new Error('no-endpoint-configured');
    const idToken = await getIdToken();
    if (!idToken) throw new Error('not-signed-in');

    const cleanHistory = buildCleanHistory(chatHistory);
    const finalContent = buildFinalContent(userMessage, attachment);

    const response = await fetch(AIBRAM_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        system: buildSystemPrompt(S),
        messages: [...cleanHistory, { role: 'user', content: finalContent }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`proxy responded ${response.status}${body ? ` — ${body.slice(0, 140)}` : ''}`);
    }
    const data = await response.json();
    setAIError(null);
    return data.text || 'Something went wrong on my end. Try again in a second.';
  } catch (e) {
    if (!AIBRAM_FUNCTION_URL) setAIError('AIBRAM_FUNCTION_URL is empty — paste your deployed callAibram URL.');
    else if (!LAST_AI_ERROR) setAIError(`Proxy call failed: ${e?.message || 'unknown'}`);
    await new Promise(r => setTimeout(r, 900 + Math.random() * 800));
    return offlineFallbackReply(S, userMessage);
  }
}

async function callAIWithTools(S, chatHistory, userMessage, attachment = null) {
  try {
    if (!AIBRAM_FUNCTION_URL) throw new Error('no-endpoint-configured');
    const idToken = await getIdToken();
    if (!idToken) throw new Error('not-signed-in');

    const cleanHistory = buildCleanHistory(chatHistory);
    const finalContent = buildFinalContent(userMessage, attachment);

    const response = await fetch(AIBRAM_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        system: buildSystemPrompt(S, true),
        messages: [...cleanHistory, { role: 'user', content: finalContent }],
        tools: AIBRAM_TOOLS,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`proxy responded ${response.status}${body ? ` — ${body.slice(0, 140)}` : ''}`);
    }
    const data = await response.json();
    setAIError(null);
    const blocks = data.content || [];
    const toolUses = blocks.filter(b => b.type === 'tool_use').map(b => ({ name: b.name, input: b.input, id: b.id }));
    const text = data.text || (toolUses.length > 0 ? '' : 'Something went wrong on my end. Try again in a second.');
    return { text, toolUses, rawContent: blocks };
  } catch (e) {
    if (!AIBRAM_FUNCTION_URL) setAIError('AIBRAM_FUNCTION_URL is empty — paste your deployed callAibram URL.');
    else if (!LAST_AI_ERROR) setAIError(`Proxy call failed: ${e?.message || 'unknown'}`);
    await new Promise(r => setTimeout(r, 900 + Math.random() * 800));
    return { text: offlineFallbackReply(S, userMessage), toolUses: [], rawContent: null };
  }
}

async function fetchMorningNews(S) {
  try {
    if (!AIBRAM_NEWS_URL) return null;
    const idToken = await getIdToken();
    if (!idToken) return null;
    const query = S.weather?.city ? `local news ${S.weather.city}` : 'top news today';
    const response = await fetch(AIBRAM_NEWS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.results || null;
  } catch (e) {
    console.log('Morning news fetch failed:', e);
    return null;
  }
}

async function fetchETA(S, destination) {
  try {
    if (!AIBRAM_ETA_URL || !destination) return null;
    if (!S.weather?.latitude || !S.weather?.longitude) return null;
    const idToken = await getIdToken();
    if (!idToken) return null;
    const origin = `${S.weather.latitude},${S.weather.longitude}`;
    const response = await fetch(AIBRAM_ETA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ origin, destination }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.ok) return null;
    return { durationMin: data.durationMin, distanceText: data.distanceText };
  } catch (e) {
    console.log('ETA fetch failed:', e);
    return null;
  }
}

const ACTION_LABELS = {
  add_task: { verb: 'Add a task', icon: 'calendar', color: '101,167,255' },
  add_event: { verb: 'Schedule an event', icon: 'clock', color: '74,222,128' },
  add_node: { verb: 'Save to Space', icon: 'lightbulb', color: '167,139,250' },
};
const describeAction = (tool, input) => {
  if (tool === 'add_task') return `"${input.title}"${input.date ? ` on ${input.date}` : ' today'}${input.time ? ` at ${input.time}` : ''}${input.priority ? ` · ${input.priority} priority` : ''}`;
  if (tool === 'add_event') return `"${input.title}" — ${input.date} at ${input.time}${input.location ? ` · ${input.location}` : ''}${input.repeat_weekly ? ' · repeats weekly' : ''}`;
  if (tool === 'add_node') return `${input.type}: "${input.title}"`;
  return '';
};
const StepsCard = ({ steps }) => (
  <View style={{ alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: 'rgba(108,99,255,0.05)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.18)', borderRadius: 14, padding: 14, marginTop: 8 }}>
    {steps.title && <Text style={{ fontSize: 11, fontWeight: '700', color: C.drift, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>{steps.title}</Text>}
    <View style={{ gap: 10 }}>
      {steps.steps.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(108,99,255,0.14)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: C.drift }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {s.label && <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, marginBottom: 2 }}>{s.label}</Text>}
            <Text style={{ fontSize: 13, color: '#d4d4e8', lineHeight: 19 }}>{s.text}</Text>
          </View>
        </View>
      ))}
    </View>
    {steps.result && (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
        <Icon name="zap" size={12} color={C.nova} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.nova }}>{steps.result}</Text>
      </View>
    )}
  </View>
);

const ChartCard = ({ chart }) => {
  const values = chart.values.map(v => Number(v) || 0);
  const max = Math.max(...values, 1);
  const barW = 46;
  const gap = 16;
  const chartH = 120;
  const w = chart.labels.length * (barW + gap) + gap;
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: 'rgba(108,99,255,0.05)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.18)', borderRadius: 14, padding: 14, marginTop: 8 }}>
      {chart.title && <Text style={{ fontSize: 11, fontWeight: '700', color: C.drift, letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' }}>{chart.title}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={w} height={chartH + 34}>
          {values.map((v, i) => {
            const h = Math.max(4, (v / max) * chartH);
            const x = gap + i * (barW + gap);
            const y = chartH - h;
            return (
              <React.Fragment key={i}>
                <Rect x={x} y={y} width={barW} height={h} rx={6} fill="#6c63ff" opacity={0.8} />
                <SvgText x={x + barW / 2} y={y - 6} fontSize="10" fill="#c9c2ff" textAnchor="middle">
                  {chart.unit === '$' ? `$${v.toFixed(0)}` : v}
                </SvgText>
                <SvgText x={x + barW / 2} y={chartH + 18} fontSize="10" fill="#8b8fb5" textAnchor="middle">
                  {(chart.labels[i] || '').length > 8 ? chart.labels[i].slice(0, 7) + '…' : chart.labels[i]}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
};

const ActionCard = ({ msg, A }) => {
  const meta = ACTION_LABELS[msg.tool] || { verb: 'Proposed action', icon: 'zap', color: '108,99,255' };
  const resolved = msg.status !== 'pending';
  const handle = (approve) => {
    if (approve) {
      if (msg.tool === 'add_task') A.addTask(msg.input.title, { date: msg.input.date, time: msg.input.time, priority: msg.input.priority });
      else if (msg.tool === 'add_event') A.addEvent(msg.input.title, msg.input.date, msg.input.time, { repeatWeekly: !!msg.input.repeat_weekly, location: msg.input.location });
      else if (msg.tool === 'add_node') A.addNode(msg.input.type, msg.input.title, msg.input.body);
    }
    A.resolveAction(msg.actionId, approve ? 'approved' : 'declined');
  };
  return (
    <View style={{
      alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: `rgba(${meta.color},0.06)`,
      borderWidth: 1, borderColor: `rgba(${meta.color},${resolved ? 0.15 : 0.32})`, borderRadius: 14, padding: 14, opacity: resolved && msg.status === 'declined' ? 0.55 : 1,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: `rgba(${meta.color},0.15)`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={meta.icon} size={13} color={`rgb(${meta.color})`} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: `rgb(${meta.color})`, letterSpacing: 0.5 }}>{meta.verb.toUpperCase()}</Text>
      </View>
      <Text style={{ fontSize: 13, color: C.text, lineHeight: 19, marginBottom: resolved ? 0 : 12 }}>{describeAction(msg.tool, msg.input)}</Text>
      {!resolved ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => handle(false)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 12, color: C.muted, fontWeight: '600' }}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handle(true)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: `rgb(${meta.color})` }}>
            <Text style={{ fontSize: 12, color: '#08090f', fontWeight: '700' }}>Approve</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{msg.status === 'approved' ? '✓ Done' : 'Skipped'}</Text>
      )}
    </View>
  );
};

const AibramPanel = ({ S, A }) => {
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [aiError, setAiErrorState] = useState(null);
  const scrollRef = useRef(null);

  const pickAttachment = async () => {
    if (!S.isPlus) { A.setShowPaywall(true); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      if ((file.size || 0) > 8 * 1024 * 1024) { A.toast('That file is too large — 8MB max for now.'); return; }
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
      setAttachment({ name: file.name || 'file', mime: file.mimeType || 'application/pdf', base64 });
    } catch (e) {
      console.log('Attachment pick failed:', e);
      A.toast("Couldn't read that file. Try a different one.");
    }
  };

  const send = async (override = null) => {
    const text = (override || input).trim();
    if ((!text && !attachment) || thinking) return;
    setInput('');
    const outgoing = attachment;
    setAttachment(null);
    const history = S.chat;
    A.pushChat({ role: 'user', content: text || `(sent a file: ${outgoing?.name})`, attachmentName: outgoing?.name });
    A.addXP(10);
    setThinking(true);
    const msgCount = history.filter(m => m.role === 'user').length + 1;
    const { text: reply, toolUses, rawContent } = await callAIWithTools(S, history, text || 'I attached a file — walk me through what matters in it.', outgoing);
    setThinking(false);
    setAiErrorState(LAST_AI_ERROR);
    const { cleanText, steps, chart, memoryFacts: newFacts } = parseAibramBlocks(reply);
    if (cleanText || steps || chart) A.pushChat({ role: 'assistant', content: cleanText, steps, chart });
    if (S.isPlus && newFacts) A.addMemoryFacts(newFacts);
    const turnId = 'turn' + Date.now() + Math.random().toString(36).slice(2, 6);
    toolUses.forEach(tu => {
      A.pushChat({ role: 'action', tool: tu.name, input: tu.input, toolUseId: tu.id, turnId, rawContent, status: 'pending', actionId: 'act' + Date.now() + Math.random().toString(36).slice(2, 6) });
    });
    if (msgCount % 8 === 0) {
      A.pushChat({ role: 'ad', content: null });
    }
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [S.chat.length, thinking]);

  const openToday = S.tasks.filter(t => t.date === today() && !t.done).length;
  const vibeIconName = { Recharging: 'battery', Steady: 'zap', 'Locked In': 'flame' }[S.user.vibe];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.glassBorder }}>
        <AibramOrb size={40} thinking={thinking} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>Aibram</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {thinking ? <PulseDot color={C.drift} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.nova }} />}
            <Text style={{ fontSize: 11, color: C.muted }}>{thinking ? 'Thinking...' : 'Present · context aware'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
              <Icon name={vibeIconName} size={10} color={C.muted} />
              <Text style={{ fontSize: 10, color: C.muted }}>{S.user.vibe}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Clear Chat?', 'Deletes all conversation history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: A.clearChat }])} style={{ padding: 8 }}>
          <Icon name="trash" size={14} color={C.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Coachmark id="aibram" seen={S.seenCoachmarks?.aibram} onDismiss={() => A.dismissCoachmark('aibram')} />
        <View style={{ backgroundColor: 'rgba(108,99,255,0.07)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.15)', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 11, color: C.muted }}>Aibram knows your full world right now — {openToday} open tasks, {S.nodes.length} Space ideas, {S.goals.length} goals. Ask anything.</Text>
        </View>

        {S.chat.map((m, i) => {
          if (m.role === 'ad') {
            if (S.isPlus || !BannerAd) return null;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 8, letterSpacing: 1, color: C.muted, opacity: 0.5, textTransform: 'uppercase' }}>Advertisement</Text>
                <BannerAd
                  unitId={ADMOB_BANNER_UNIT_ID}
                  size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                  requestOptions={{ requestNonPersonalizedAdsOnly: false }}
                  onAdFailedToLoad={(err) => console.log('Banner ad failed to load:', err)}
                />
              </View>
            );
          }
          if (m.role === 'user') {
            return (
              <View key={i} style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: 'rgba(108,99,255,0.15)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)', borderRadius: 16, borderBottomRightRadius: 4, padding: 12 }}>
                <Text style={{ fontSize: 13, color: C.text, lineHeight: 20 }}>{m.content}</Text>
              </View>
            );
          }
          if (m.role === 'action') {
            return <ActionCard key={i} msg={m} A={A} />;
          }
          return (
            <View key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(108,99,255,0.3)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)' }} />
                <Text style={{ fontSize: 10, color: C.pulse, letterSpacing: 1, fontWeight: '700' }}>AIBRAM</Text>
              </View>
              {!!m.content && <Text style={{ fontSize: 13, color: '#d4d4e8', lineHeight: 22 }}>{m.content}</Text>}
              {m.steps && <StepsCard steps={m.steps} />}
              {m.chart && <ChartCard chart={m.chart} />}
            </View>
          );
        })}

        {thinking && (
          <View style={{ alignSelf: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(108,99,255,0.3)' }} />
              <Text style={{ fontSize: 10, color: C.pulse, letterSpacing: 1, fontWeight: '700' }}>AIBRAM</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4, padding: 8 }}>
              <PulseDot /><PulseDot /><PulseDot />
            </View>
          </View>
        )}

        {S.chat.filter(m => m.role === 'user').length === 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {['What matters now?', 'Plan today', 'Morning briefing', 'Motivate me'].map((q, i) => (
              <TouchableOpacity key={q} onPress={() => send(['What should I focus on today?', 'Help me plan the rest of today.', 'Give me a morning briefing.', 'I need motivation right now.'][i])} style={{ paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 999 }}>
                <Text style={{ fontSize: 11, color: C.muted }}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {aiError && (
        <View style={{ marginHorizontal: 12, marginBottom: 4, backgroundColor: 'rgba(244,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(244,113,113,0.28)', borderRadius: 12, padding: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Icon name="warning" size={12} color={C.red} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.red }}>Aibram is offline — that reply was a fallback</Text>
          </View>
          <Text style={{ fontSize: 10.5, color: C.muted, lineHeight: 15 }}>{aiError}</Text>
        </View>
      )}

      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: C.glassBorder }}>
        {attachment && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="paperclip" size={11} color={C.drift} />
              <Text style={{ fontSize: 11, color: C.drift }}>{attachment.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setAttachment(null)}>
              <Text style={{ fontSize: 12, color: C.muted }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <TouchableOpacity onPress={pickAttachment} disabled={thinking} style={{
            width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
            borderColor: S.isPlus ? 'rgba(108,99,255,0.35)' : C.glassBorder,
            alignItems: 'center', justifyContent: 'center', marginBottom: 6,
          }}>
            <Icon name="paperclip" size={14} color={S.isPlus ? C.drift : C.muted} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 18, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 }}>
            <TextInput
              value={input} onChangeText={setInput} placeholder={attachment ? 'Ask about this file...' : 'Talk through anything...'} placeholderTextColor={C.muted}
              multiline style={{ flex: 1, color: C.text, fontSize: 13, maxHeight: 100, paddingTop: 6, paddingBottom: 6 }}
            />
            <TouchableOpacity onPress={() => send()} disabled={thinking || (!input.trim() && !attachment)} style={{
              width: 34, height: 34, borderRadius: 17, backgroundColor: C.pulse, alignItems: 'center', justifyContent: 'center',
              opacity: thinking || (!input.trim() && !attachment) ? 0.4 : 1, marginLeft: 6,
            }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FOCUS — setup · active · complete
// Deep Focus and Mindfulness are two genuinely different experiences now:
// Deep Focus = timer + task + intent. Mindfulness = breathing
// pattern + ambient sound only, no task list, no countdown pressure.
// ═══════════════════════════════════════════════════════════════════════════
const RING_R = 120;
const RING_CIRC = 2 * Math.PI * RING_R;

const BREATH_PATTERNS = [
  { id: 'box', name: 'Box breathing', desc: '4 in · 4 hold · 4 out · 4 hold', phases: ['Inhale...', 'Hold...', 'Exhale...', 'Hold...'], durs: [4000, 4000, 4000, 4000], scales: [1.15, 1.15, 1, 1] },
  { id: '478', name: '4-7-8', desc: '4 in · 7 hold · 8 out', phases: ['Inhale...', 'Hold...', 'Exhale...'], durs: [4000, 7000, 8000], scales: [1.15, 1.15, 1] },
  { id: 'simple', name: 'Simple', desc: 'In, out — your own pace', phases: ['Inhale...', 'Exhale...'], durs: [4500, 4500], scales: [1.15, 1] },
];

const FocusPanel = ({ S, A }) => {
  const [phase, setPhase] = useState('setup'); // setup | active | complete
  const [mode, setMode] = useState('deep');
  const [duration, setDuration] = useState(25);
  const [sound, setSound] = useState('none'); // Mindfulness ambient sound only
  const [breathPattern, setBreathPattern] = useState('box');
  const [taskId, setTaskId] = useState(S.tasks.find(t => !t.done)?.id || null);
  const [taskIntent, setTaskIntent] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [breath, setBreath] = useState('Inhale...');
  const [reflect, setReflect] = useState('');
  const timerRef = useRef(null);
  const breathRef = useRef(null);
  const breathScale = useRef(new Animated.Value(1)).current;
  const ambient = useAmbientSound();

  const openTasks = S.tasks.filter(t => !t.done).slice(0, 5);
  const focusTask = S.tasks.find(t => t.id === taskId);

  const begin = () => {
    setPhase('active');
    setPaused(false);
    setRemaining(duration ? duration * 60 : 0);
    if (sound !== 'none') ambient.play(sound);
    if (mode !== 'deep') {
      // Mindfulness — cycle the chosen breathing pattern, animate the circle.
      const pattern = BREATH_PATTERNS.find(p => p.id === breathPattern) || BREATH_PATTERNS[0];
      let bi = 0;
      const cycle = () => {
        setBreath(pattern.phases[bi]);
        Animated.timing(breathScale, {
          toValue: pattern.scales[bi],
          duration: pattern.durs[bi],
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
        breathRef.current = setTimeout(() => { bi = (bi + 1) % pattern.phases.length; cycle(); }, pattern.durs[bi]);
      };
      cycle();
    }
  };

  useEffect(() => {
    if (phase !== 'active') return;
    timerRef.current = setInterval(() => {
      setRemaining(r => paused ? r : (duration > 0 ? Math.max(0, r - 1) : r + 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, paused, duration]);

  useEffect(() => {
    if (phase === 'active' && duration > 0 && remaining <= 0) finish();
  }, [remaining, phase, duration]);

  const finish = (auto = false) => {
    clearInterval(timerRef.current);
    clearTimeout(breathRef.current);
    ambient.stop();
    const elapsed = duration ? Math.max(1, Math.round((duration * 60 - remaining) / 60)) : Math.max(1, Math.round(remaining / 60));
    A.finishFocus(elapsed);
    setPhase('complete');
  };

  const cancel = () => {
    clearInterval(timerRef.current);
    clearTimeout(breathRef.current);
    ambient.stop();
    setPhase('setup');
    A.toast(mode === 'deep' ? 'Session ended. Your commitment is still here when you return.' : 'Session ended. No pressure — come back whenever.');
  };

  const saveReflection = () => {
    A.saveFocusReflection(reflect, focusTask);
    setReflect('');
    setTaskIntent('');
    setPhase('setup');
  };

  const mins = Math.floor(Math.max(0, remaining) / 60);
  const secs = Math.max(0, remaining) % 60;
  const prog = duration > 0 ? (duration * 60 - remaining) / (duration * 60) : 0;

  if (phase === 'active') {
    if (mode === 'mindfulness') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 10, letterSpacing: 2, color: C.drift, textTransform: 'uppercase', fontWeight: '700', marginBottom: 24 }}>Mindfulness</Text>
          <Animated.View style={{
            width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.45)',
            transform: [{ scale: breathScale }],
          }}>
            <Text style={{ fontSize: 17, color: C.text, fontWeight: '500' }}>{breath}</Text>
          </Animated.View>
          {duration > 0 && <Text style={{ fontSize: 13, color: C.muted, marginTop: 40 }}>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} remaining</Text>}
          <Text style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>No pressure, no timer running out. Just breathe.</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 26 }}>
            <TouchableOpacity onPress={() => finish()} style={st.focusCtrl}><Text style={{ color: C.muted, fontSize: 15 }}>✓</Text></TouchableOpacity>
            <TouchableOpacity onPress={cancel} style={st.focusCtrl}><Text style={{ color: C.muted, fontSize: 15 }}>■</Text></TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 10, letterSpacing: 2, color: C.nova, textTransform: 'uppercase', fontWeight: '700', marginBottom: 24 }}>In Focus</Text>
        <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <Svg width={280} height={280} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={140} cy={140} r={RING_R} stroke="rgba(255,255,255,0.06)" strokeWidth={4} fill="none" />
            <Circle cx={140} cy={140} r={RING_R} stroke={C.nova} strokeWidth={4} fill="none" strokeLinecap="round"
              strokeDasharray={RING_CIRC} strokeDashoffset={RING_CIRC * (1 - prog)} />
          </Svg>
          <Text style={{ fontSize: 52, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] }}>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</Text>
          <Text style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{focusTask ? focusTask.title : 'Open focus session'}</Text>
          {!!taskIntent && <Text style={{ fontSize: 11, color: C.drift, marginTop: 4, maxWidth: 220, textAlign: 'center' }}>{taskIntent}</Text>}
          <Text style={{ fontSize: 10, letterSpacing: 2, color: C.nova, marginTop: 6, fontWeight: '700' }}>{paused ? 'PAUSED' : duration ? 'IN FOCUS' : 'OPEN-ENDED FOCUS'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => setPaused(p => !p)} style={st.focusCtrl}><Icon name={paused ? 'play' : 'pause'} size={14} color={C.muted} /></TouchableOpacity>
          <TouchableOpacity onPress={() => finish()} style={st.focusCtrl}><Text style={{ color: C.muted, fontSize: 15 }}>✓</Text></TouchableOpacity>
          <TouchableOpacity onPress={cancel} style={st.focusCtrl}><Text style={{ color: C.muted, fontSize: 15 }}>■</Text></TouchableOpacity>
        </View>
        <Text style={{ fontSize: 10, color: C.muted, marginTop: 20 }}>Aibram is present, but quiet. Your attention comes first.</Text>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 26, color: C.nova }}>✓</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 8 }}>{mode === 'deep' ? 'Meaningful progress made.' : 'That was time well spent.'}</Text>
        <Text style={{ fontSize: 13, color: C.muted, marginBottom: 16, textAlign: 'center' }}>{mode === 'deep' ? 'Take a moment to preserve what changed.' : 'No need to log anything — but if something came up, it can go here.'}</Text>
        <TextInput
          value={reflect} onChangeText={setReflect} multiline
          placeholder={mode === 'deep' ? 'What did you accomplish? What should happen next?' : 'Anything worth remembering from this session?'} placeholderTextColor={C.muted}
          style={{ width: '100%', minHeight: 90, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12, padding: 12, color: C.text, fontSize: 13, lineHeight: 20, textAlignVertical: 'top', marginBottom: 16 }}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => setPhase('setup')} style={{ paddingVertical: 11, paddingHorizontal: 24, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>Skip for now</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveReflection} style={{ paddingVertical: 11, paddingHorizontal: 24, borderRadius: 999, backgroundColor: C.pulse }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Save reflection</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // setup
  const Chip = ({ label, on, onPress, icon }) => (
    <TouchableOpacity onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
      borderColor: on ? 'rgba(74,222,128,0.4)' : C.glassBorder,
      backgroundColor: on ? 'rgba(74,222,128,0.1)' : 'transparent',
    }}>
      {icon && <Icon name={icon} size={11} color={on ? C.nova : C.muted} />}
      <Text style={{ fontSize: 12, color: on ? C.nova : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Kicker>Focus</Kicker>
      <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 6 }}>Close the door to everything else.</Text>
      <Text style={{ fontSize: 13, color: C.muted, lineHeight: 20, marginBottom: 20 }}>Pick a mode, set it up, and give it your full attention.</Text>

      <Coachmark id="focus" style={{ marginBottom: 16 }} seen={S.seenCoachmarks?.focus} onDismiss={() => A.dismissCoachmark('focus')} />

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
        {[
          { id: 'deep', rgb: '74,222,128', icon: 'timer', name: 'Deep Focus', desc: 'Countdown timer · task intent · lock in and work' },
          { id: 'mindfulness', rgb: '167,139,250', icon: 'leaf', name: 'Mindfulness', desc: 'Guided breathing · your own pace · no pressure' },
        ].map(m => {
          const on = mode === m.id;
          return (
            <TouchableOpacity key={m.id} onPress={() => setMode(m.id)} style={{
              flex: 1, backgroundColor: on ? `rgba(${m.rgb},0.07)` : C.glass, borderWidth: 1,
              borderColor: on ? `rgba(${m.rgb},0.4)` : C.glassBorder, borderRadius: 16, padding: 16,
            }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `rgba(${m.rgb},0.12)`, borderWidth: 1, borderColor: `rgba(${m.rgb},0.2)`, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon name={m.icon} size={16} color={`rgb(${m.rgb})`} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 4 }}>{m.name}</Text>
              <Text style={{ fontSize: 11, color: C.muted, lineHeight: 16 }}>{m.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'deep' ? (
        <Glass style={{ padding: 18, marginBottom: 16 }}>
          <Kicker color={C.muted}>Session Rhythm</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {[[0, 'Open-ended'], [25, '25 min'], [45, '45 min'], [60, '60 min']].map(([d, label]) => (
              <Chip key={label} label={label} on={duration === d} onPress={() => setDuration(d)} />
            ))}
          </View>
          <Kicker color={C.muted}>Working On</Kicker>
          <View style={{ gap: 6, marginBottom: taskId ? 14 : 0 }}>
            {openTasks.length === 0 && <Text style={{ color: C.muted, fontSize: 12 }}>No open tasks — create a free focus session.</Text>}
            {openTasks.map(t => {
              const on = taskId === t.id;
              return (
                <TouchableOpacity key={t.id} onPress={() => setTaskId(t.id)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, borderWidth: 1,
                  borderColor: on ? 'rgba(74,222,128,0.38)' : C.glassBorder,
                  backgroundColor: on ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.02)',
                }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: on ? 'rgba(74,222,128,0.5)' : C.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.nova }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: on ? C.nova : C.text }}>{t.title}</Text>
                    <Text style={{ fontSize: 10, color: C.muted }}>{t.project || 'Independent'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {taskId && (
            <View style={{ marginBottom: 16 }}>
              <Kicker color={C.muted} style={{ marginTop: 4 }}>What does done look like?</Kicker>
              <TextInput
                value={taskIntent} onChangeText={setTaskIntent}
                placeholder="One line — the visible outcome you're aiming for" placeholderTextColor={C.muted}
                style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: C.glassBorder, borderRadius: 10, padding: 11, color: C.text, fontSize: 12.5 }}
              />
            </View>
          )}
          <Kicker color={C.muted}>Background Sound (optional)</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[['none', 'Quiet', null], ['rain', 'Rain', 'cloud-rain'], ['white', 'White noise', null], ['forest', 'Forest', 'leaf'], ['lofi', 'Lo-fi', 'zap']].map(([sId, label, ic]) => (
              <Chip key={sId} label={label} icon={ic} on={sound === sId} onPress={() => setSound(sId)} />
            ))}
          </View>
        </Glass>
      ) : (
        <Glass style={{ padding: 18, marginBottom: 16 }}>
          <Kicker color={C.muted}>How long do you want to sit</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {[[0, 'Open-ended'], [5, '5 min'], [10, '10 min'], [20, '20 min']].map(([d, label]) => (
              <Chip key={label} label={label} on={duration === d} onPress={() => setDuration(d)} />
            ))}
          </View>
          <Kicker color={C.muted}>Breathing Pattern</Kicker>
          <View style={{ gap: 6, marginBottom: 16 }}>
            {BREATH_PATTERNS.map(p => {
              const on = breathPattern === p.id;
              return (
                <TouchableOpacity key={p.id} onPress={() => setBreathPattern(p.id)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, borderWidth: 1,
                  borderColor: on ? 'rgba(167,139,250,0.4)' : C.glassBorder,
                  backgroundColor: on ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)',
                }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: on ? 'rgba(167,139,250,0.55)' : C.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.drift }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: on ? C.drift : C.text }}>{p.name}</Text>
                    <Text style={{ fontSize: 10, color: C.muted }}>{p.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Kicker color={C.muted}>Ambient Sound</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[['none', 'Quiet', null], ['rain', 'Rain', 'cloud-rain'], ['white', 'White noise', null], ['forest', 'Forest', 'leaf']].map(([sId, label, ic]) => (
              <Chip key={sId} label={label} icon={ic} on={sound === sId} onPress={() => setSound(sId)} />
            ))}
          </View>
        </Glass>
      )}

      <TouchableOpacity onPress={begin} style={{ backgroundColor: C.pulse, borderRadius: 999, padding: 15, alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Begin Session →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SPACE — List + Graph views
// ═══════════════════════════════════════════════════════════════════════════
const graphPos = {
  n1: { x: 50, y: 48 }, n2: { x: 22, y: 16 }, n3: { x: 78, y: 16 },
  n4: { x: 80, y: 76 }, n5: { x: 18, y: 76 }, n6: { x: 36, y: 44 },
  n7: { x: 68, y: 32 }, n8: { x: 64, y: 72 },
};
const nodeTypeOrder = ['project', 'idea', 'principle', 'question', 'research', 'goal', 'story'];

const nodeRelatedness = (a, b) => {
  const stop = new Set(['the', 'a', 'an', 'is', 'are', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'with', 'that', 'this', 'it', 'as', 'be', 'was', 'were']);
  const words = (str) => str.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stop.has(w));
  const wa = new Set([...words(a.title), ...words(a.body)]);
  const wb = new Set([...words(b.title), ...words(b.body)]);
  let overlap = 0;
  wa.forEach(w => { if (wb.has(w)) overlap++; });
  const typeScore = { 'goal+project': 2, 'idea+project': 2, 'question+research': 2, 'idea+principle': 1, 'idea+research': 1, 'goal+story': 1 };
  overlap += typeScore[[a.type, b.type].sort().join('+')] || 0;
  return overlap;
};

const NODE_GLYPH = { project: '▣', idea: 'lightbulb', principle: '✦', question: '?', research: 'search', goal: '◎', story: '≡' };

const GraphNode = ({ n, pos, containerW, containerH, connCount, justConnected, dimmed, isSelected, onSelect, onDragEnd }) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(justConnected ? 1 : 0)).current;
  const dragging = useRef(false);

  useEffect(() => {
    const stagger = (n.id.charCodeAt(n.id.length - 1) * 53) % 900;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 2500 + stagger, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 2500 + stagger, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (justConnected) {
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    }
  }, [justConnected]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
    onPanResponderGrant: () => { dragging.current = false; },
    onPanResponderMove: (evt, g) => {
      if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) dragging.current = true;
      pan.setValue({ x: g.dx, y: g.dy });
    },
    onPanResponderRelease: (_, g) => {
      if (!dragging.current) {
        onSelect(n.id);
      } else if (containerW && containerH) {
        const nx = Math.max(4, Math.min(92, pos.x + (g.dx / containerW) * 100));
        const ny = Math.max(4, Math.min(92, pos.y + (g.dy / containerH) * 100));
        onDragEnd(n.id, { x: nx, y: ny });
      }
      pan.setValue({ x: 0, y: 0 });
    },
  })).current;

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  // Small dot/star instead of a full card — size nudges up slightly for
  // well-connected hubs and pinned nodes, but stays touch-friendly (44pt
  // hit target via hitSlop) rather than growing the visible mark itself.
  const DOT_SIZE = 14 + Math.min(connCount, 3) * 2 + (n.pinned ? 2 : 0);
  const glowSize = DOT_SIZE + 8;
  const hubGlow = connCount >= 2;
  const LABEL_W = 150;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      style={{
        position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
        width: DOT_SIZE, height: DOT_SIZE, marginLeft: -DOT_SIZE / 2, marginTop: -DOT_SIZE / 2,
        opacity: dimmed ? 0.22 : 1, alignItems: 'center', justifyContent: 'center',
        transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
      }}
    >
      {/* Soft glow halo — bigger/brighter for hubs and pinned ideas, kept
          tight to the dot so it doesn't bleed into neighboring nodes/labels */}
      <View pointerEvents="none" style={{
        position: 'absolute', width: glowSize, height: glowSize, borderRadius: glowSize / 2,
        backgroundColor: `rgba(${n.color},${hubGlow ? 0.16 : 0.09})`,
      }} />
      {/* The mark itself — a star for pinned nodes, a dot for everything else */}
      {n.pinned ? (
        <Text style={{ fontSize: DOT_SIZE, color: C.flare, lineHeight: DOT_SIZE + 2 }}>★</Text>
      ) : (
        <View style={{
          width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2,
          backgroundColor: `rgb(${n.color})`, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
        }} />
      )}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', width: glowSize + 6, height: glowSize + 6, borderRadius: (glowSize + 6) / 2,
        borderWidth: 2, borderColor: C.flare, opacity: flash,
      }} />
      {/* Title only appears once tapped — floats above the dot, the full
          detail (body, backlinks, actions) still opens in the bottom sheet. */}
      {isSelected && (
        <View pointerEvents="none" style={{
          position: 'absolute', bottom: DOT_SIZE + 6, width: LABEL_W, marginLeft: -(LABEL_W - DOT_SIZE) / 2,
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: 'rgba(8,9,20,0.96)', borderWidth: 1, borderColor: `rgba(${n.color},0.5)`,
            borderRadius: 10, paddingVertical: 5, paddingHorizontal: 10,
          }}>
            <Text numberOfLines={2} style={{ fontSize: 11.5, fontWeight: '600', color: C.text, textAlign: 'center' }}>{n.title}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const SpacePanel = ({ S, A }) => {
  const [view, setView] = useState('graph');
  const [search, setSearch] = useState('');
  const [selNode, setSelNode] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [layout, setLayout] = useState({ w: SW - 8, h: SH * 0.5 });
  const [typeFilter, setTypeFilter] = useState(null);
  const [capture, setCapture] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const graphW = layout.w;
  const graphH = layout.h;

  const filtered = S.nodes.filter(n => {
    if (typeFilter && n.type !== typeFilter) return false;
    if (search && !`${n.title} ${n.body} ${n.type}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const resolvedPositions = React.useMemo(() => {
    const pos = {};
    filtered.forEach(n => {
      if (S.nodePositions[n.id]) { pos[n.id] = { ...S.nodePositions[n.id] }; return; }
      const h = parseInt(n.id.slice(1), 36) || 1;
      pos[n.id] = { x: 22 + ((h * 7) % 56), y: 22 + ((h * 13) % 56) };
    });
    const ids = filtered.map(n => n.id);
    const MIN_DIST = 24;
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos[ids[i]], b = pos[ids[j]];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (dist < MIN_DIST) {
            const push = (MIN_DIST - dist) / 2;
            const ux = dx / dist, uy = dy / dist;
            a.x = Math.max(8, Math.min(92, a.x - ux * push));
            a.y = Math.max(8, Math.min(92, a.y - uy * push));
            b.x = Math.max(8, Math.min(92, b.x + ux * push));
            b.y = Math.max(8, Math.min(92, b.y + uy * push));
          }
        }
      }
    }
    return pos;
  }, [filtered.map(n => n.id).join(','), S.nodePositions]);

  const typesPresent = [...new Set(S.nodes.map(n => n.type))].sort((a, b) => nodeTypeOrder.indexOf(a) - nodeTypeOrder.indexOf(b));

  const grouped = {};
  nodeTypeOrder.forEach(t => grouped[t] = []);
  filtered.forEach(n => { if (!grouped[n.type]) grouped[n.type] = []; grouped[n.type].push(n); });

  const connectedIds = new Set(S.connections.flat());
  const isolated = S.nodes.filter(n => !connectedIds.has(n.id));

  const focusSet = (() => {
    if (!selNode) return null;
    const set = new Set([selNode]);
    S.connections.forEach(([a, b]) => {
      if (a === selNode) set.add(b);
      if (b === selNode) set.add(a);
    });
    return set;
  })();

  const autoOrganize = () => {
    let added = 0;
    const newConns = [...S.connections];
    for (let i = 0; i < S.nodes.length; i++) {
      for (let j = i + 1; j < S.nodes.length; j++) {
        if (nodeRelatedness(S.nodes[i], S.nodes[j]) >= 2) {
          const exists = newConns.some(c =>
            (c[0] === S.nodes[i].id && c[1] === S.nodes[j].id) || (c[1] === S.nodes[i].id && c[0] === S.nodes[j].id));
          if (!exists) { newConns.push([S.nodes[i].id, S.nodes[j].id]); added++; }
        }
      }
    }
    A.setConnections(newConns);

    const pos = { ...S.nodePositions };
    S.nodes.forEach(n => {
      const neighbors = newConns.filter(c => c.includes(n.id)).map(c => c[0] === n.id ? c[1] : c[0]);
      if (neighbors.length === 0) return;
      const nx = neighbors.reduce((sum, id) => sum + (pos[id]?.x ?? 50), 0) / neighbors.length;
      const ny = neighbors.reduce((sum, id) => sum + (pos[id]?.y ?? 50), 0) / neighbors.length;
      const cur = pos[n.id] || { x: 50, y: 50 };
      pos[n.id] = {
        x: Math.max(8, Math.min(92, cur.x + (nx - cur.x) * 0.35)),
        y: Math.max(10, Math.min(90, cur.y + (ny - cur.y) * 0.35)),
      };
    });
    A.setAllNodePositions(pos);
    A.toast(added > 0 ? `Space organized — ${added} new connection${added !== 1 ? 's' : ''}, related ideas pulled together.` : 'Related ideas pulled closer together.');
  };

  const nodeDetail = selNode ? S.nodes.find(n => n.id === selNode) : null;
  const backlinks = nodeDetail
    ? S.connections.filter(c => c.includes(selNode)).map(c => c[0] === selNode ? c[1] : c[0]).map(id => S.nodes.find(n => n.id === id)).filter(Boolean)
    : [];

  const openNode = (id) => { setSelNode(id); setEditingNote(false); };
  const startEditNote = () => { setNoteDraft(nodeDetail?.body || ''); setEditingNote(true); };
  const saveNote = () => {
    A.updateNodeBody(selNode, noteDraft.trim() || nodeDetail.body);
    setEditingNote(false);
    A.toast('Note saved. Your thinking is preserved.');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 18, borderBottomWidth: 1, borderBottomColor: C.glassBorder, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <View>
            <Kicker>Space</Kicker>
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: -0.5 }}>Make your thinking visible.</Text>
          </View>
          <TouchableOpacity onPress={() => A.openModal('addNode')} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(108,99,255,0.14)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.pulse, fontSize: 20 }}>+</Text>
          </TouchableOpacity>
        </View>
        <Coachmark id="space" style={{ marginBottom: 10 }} seen={S.seenCoachmarks?.space} onDismiss={() => A.dismissCoachmark('space')} />
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C.glassBorder, borderRadius: 10, paddingHorizontal: 12 }}>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search ideas..." placeholderTextColor={C.muted}
              style={{ color: C.text, fontSize: 13, paddingVertical: 8 }} />
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 2 }}>
            {[['graph', 'Graph'], ['list', 'List']].map(([id, label]) => (
              <TouchableOpacity key={id} onPress={() => setView(id)} style={{
                paddingVertical: 6, paddingHorizontal: 13, borderRadius: 8,
                backgroundColor: view === id ? 'rgba(108,99,255,0.18)' : 'transparent',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: view === id ? C.drift : C.muted }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(108,99,255,0.06)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)', borderRadius: 10, paddingHorizontal: 12 }}>
            <TextInput
              value={capture} onChangeText={setCapture}
              placeholder="Capture a thought — just start typing..." placeholderTextColor={C.muted}
              onSubmitEditing={() => { A.quickCapture(capture); setCapture(''); }}
              returnKeyType="done"
              style={{ color: C.text, fontSize: 13, paddingVertical: 8 }}
            />
          </View>
          <TouchableOpacity onPress={() => { A.quickCapture(capture); setCapture(''); }} disabled={!capture.trim()} style={{
            width: 34, height: 34, borderRadius: 10, backgroundColor: C.pulse, alignItems: 'center', justifyContent: 'center',
            opacity: capture.trim() ? 1 : 0.35,
          }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>↑</Text>
          </TouchableOpacity>
        </View>

        {typesPresent.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity onPress={() => setTypeFilter(null)} style={{
              paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
              borderColor: !typeFilter ? 'rgba(108,99,255,0.45)' : C.glassBorder,
              backgroundColor: !typeFilter ? 'rgba(108,99,255,0.12)' : 'transparent',
            }}>
              <Text style={{ fontSize: 11, color: !typeFilter ? C.drift : C.muted }}>All</Text>
            </TouchableOpacity>
            {typesPresent.map(t => {
              const on = typeFilter === t;
              const rgb = S.nodes.find(n => n.type === t)?.color || '167,139,250';
              return (
                <TouchableOpacity key={t} onPress={() => setTypeFilter(on ? null : t)} style={{
                  paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                  borderColor: on ? `rgba(${rgb},0.5)` : C.glassBorder,
                  backgroundColor: on ? `rgba(${rgb},0.1)` : 'transparent',
                }}>
                  <Text style={{ fontSize: 11, color: on ? `rgb(${rgb})` : C.muted, textTransform: 'capitalize' }}>{t}s</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {view === 'graph' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width && height) setLayout({ w: width, h: height });
            }}
            style={{ width: '100%', height: SH * 0.5, marginTop: 8 }}
          >
            <Svg width={graphW} height={graphH} style={StyleSheet.absoluteFill}>
              {(() => {
                const drawn = new Set();
                return S.connections.map(([a, b], i) => {
                  const key = [a, b].sort().join('-');
                  if (drawn.has(key)) return null;
                  drawn.add(key);
                  const pa = resolvedPositions[a] || { x: 50, y: 50 };
                  const pb = resolvedPositions[b] || { x: 50, y: 50 };
                  const isNew = S.justConnected.includes(a) && S.justConnected.includes(b);
                  const inFocus = !focusSet || a === selNode || b === selNode;
                  return <Line key={key} x1={(pa.x / 100) * graphW} y1={(pa.y / 100) * graphH} x2={(pb.x / 100) * graphW} y2={(pb.y / 100) * graphH} stroke={isNew ? 'rgba(244,200,66,0.55)' : inFocus ? 'rgba(167,139,250,0.28)' : 'rgba(167,139,250,0.05)'} strokeWidth={isNew ? 1.8 : 1.2} strokeDasharray="4 6" />;
                });
              })()}
            </Svg>
            {[...filtered].sort((a, b) => (a.pinned ? 1 : 0) - (b.pinned ? 1 : 0)).map(n => {
              const pos = resolvedPositions[n.id] || { x: 50, y: 50 };
              const conns = S.connections.filter(c => c.includes(n.id)).length;
              return (
                <GraphNode
                  key={n.id}
                  n={n}
                  pos={pos}
                  containerW={graphW}
                  containerH={graphH}
                  connCount={conns}
                  justConnected={S.justConnected.includes(n.id)}
                  dimmed={focusSet ? !focusSet.has(n.id) : false}
                  isSelected={selNode === n.id}
                  onSelect={openNode}
                  onDragEnd={A.setNodePosition}
                />
              );
            })}

            {S.spaceHint && (
              <View style={{ position: 'absolute', top: 8, left: 10, right: 10, zIndex: 30, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(108,99,255,0.14)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.32)', borderRadius: 12, padding: 10 }}>
                <PulseDot color={C.flare} />
                <Text style={{ fontSize: 11, color: C.text, flex: 1, lineHeight: 16 }}>
                  "{S.nodes.find(n => n.id === S.spaceHint.a)?.title}" and "{S.nodes.find(n => n.id === S.spaceHint.b)?.title}" seem related. Connect them?
                </Text>
                <TouchableOpacity onPress={A.acceptSpaceHint} style={{ paddingVertical: 5, paddingHorizontal: 12, backgroundColor: C.pulse, borderRadius: 999 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={A.dismissSpaceHint} style={{ padding: 2 }}>
                  <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginHorizontal: 16, backgroundColor: 'rgba(108,99,255,0.04)', borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12 }}>
            <PulseDot />
            <Text style={{ fontSize: 11, color: C.muted, flex: 1 }}>
              {isolated.length > 0 ? `${isolated.length} unconnected idea${isolated.length > 1 ? 's' : ''} — Aibram sees potential links. Drag ideas around to feel out the shape of them.` : 'Aibram is watching for connections between your ideas. Drag any idea to rearrange your thinking.'}
            </Text>
            <TouchableOpacity onPress={autoOrganize} style={{ paddingVertical: 5, paddingHorizontal: 12, backgroundColor: 'rgba(108,99,255,0.12)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)', borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.drift }}>✦ Auto-organize</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
          {Object.entries(grouped).filter(([, arr]) => arr.length > 0).map(([type, arr]) => {
            const rgb = arr[0].color;
            const isCollapsed = collapsed[type];
            return (
              <View key={type} style={{ marginBottom: 10 }}>
                <TouchableOpacity onPress={() => setCollapsed(c => ({ ...c, [type]: !c[type] }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: `rgb(${rgb})` }} />
                  <Text style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: `rgb(${rgb})`, fontWeight: '700', flex: 1 }}>{type}</Text>
                  <Text style={{ fontSize: 10, color: C.muted }}>{arr.length}</Text>
                  <Text style={{ fontSize: 10, color: C.muted }}>{isCollapsed ? '▸' : '▾'}</Text>
                </TouchableOpacity>
                {!isCollapsed && [...arr].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(n => (
                  <TouchableOpacity key={n.id} onPress={() => openNode(n.id)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 10, marginBottom: 2,
                    borderWidth: 1, borderColor: selNode === n.id ? 'rgba(108,99,255,0.2)' : 'transparent',
                    backgroundColor: selNode === n.id ? 'rgba(108,99,255,0.07)' : 'transparent',
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: `rgb(${n.color})` }} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{n.title}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{n.body}</Text>
                    </View>
                    <Text style={{ fontSize: 9, color: C.muted }}>{S.connections.filter(c => c.includes(n.id)).length} links</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {nodeDetail && (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, maxHeight: SH * 0.55, backgroundColor: 'rgba(10,11,26,0.98)', borderWidth: 1, borderColor: C.glassHi, borderRadius: 16, padding: 18 }}>
          <View style={{ position: 'absolute', top: 10, right: 12, flexDirection: 'row', gap: 4, zIndex: 2 }}>
            <TouchableOpacity onPress={() => A.togglePinNode(nodeDetail.id)} style={{ padding: 6 }}>
              <Text style={{ fontSize: 15, color: nodeDetail.pinned ? C.flare : C.muted }}>{nodeDetail.pinned ? '★' : '☆'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSelNode(null); setEditingNote(false); }} style={{ padding: 6 }}>
              <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: `rgb(${nodeDetail.color})`, fontWeight: '700', marginBottom: 6 }}>{nodeDetail.type}{nodeDetail.pinned ? ' · pinned' : ''}</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 7 }}>{nodeDetail.title}</Text>
          <ScrollView style={{ maxHeight: SH * 0.22 }}>
            {editingNote ? (
              <TextInput
                value={noteDraft} onChangeText={setNoteDraft} multiline autoFocus
                placeholder="Expand this thought — it can hold as much as you need." placeholderTextColor={C.muted}
                style={{ minHeight: 90, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', borderRadius: 10, padding: 10, color: C.text, fontSize: 13, lineHeight: 20, textAlignVertical: 'top' }}
              />
            ) : (
              <TouchableOpacity onPress={startEditNote} activeOpacity={0.7}>
                <Text style={{ fontSize: 13, color: '#c9c9dd', lineHeight: 21 }}>{nodeDetail.body}</Text>
                <Text style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: 'italic' }}>Tap to edit this note</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {!editingNote && backlinks.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted, fontWeight: '700', marginBottom: 6 }}>Linked thinking</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {backlinks.map(b => (
                  <TouchableOpacity key={b.id} onPress={() => openNode(b.id)} style={{ paddingVertical: 4, paddingHorizontal: 9, borderWidth: 1, borderColor: `rgba(${b.color},0.35)`, borderRadius: 999, backgroundColor: `rgba(${b.color},0.07)` }}>
                    <Text style={{ fontSize: 10, color: `rgb(${b.color})` }}>{b.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {editingNote ? (<>
              <TouchableOpacity onPress={() => setEditingNote(false)} style={st.nodeAction}>
                <Text style={{ fontSize: 11, color: C.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNote} style={[st.nodeAction, { backgroundColor: 'rgba(108,99,255,0.15)', borderColor: 'rgba(108,99,255,0.35)' }]}>
                <Text style={{ fontSize: 11, color: C.drift, fontWeight: '700' }}>Save note</Text>
              </TouchableOpacity>
            </>) : (<>
              <TouchableOpacity onPress={() => { setSelNode(null); A.askAboutNode(nodeDetail); }} style={st.nodeAction}>
                <Text style={{ fontSize: 11, color: C.muted }}>✦ Ask Aibram</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { A.promoteNodeToTask(nodeDetail); setSelNode(null); }} style={st.nodeAction}>
                <Text style={{ fontSize: 11, color: C.muted }}>→ Make task</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Delete this idea?', `"${nodeDetail.title}" and any connections to it will be removed. This can't be undone.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { A.deleteNode(nodeDetail.id); setSelNode(null); } },
                ])}
                style={[st.nodeAction, { borderColor: 'rgba(244,113,113,0.35)' }]}
              >
                <Icon name="trash" size={13} color={C.red} />
              </TouchableOpacity>
            </>)}
          </View>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════════════════════════════
const TimelinePanel = ({ S, A }) => {
  const [chapter, setChapter] = useState('Building Aibram');
  const stories = S.timeline.filter(s => !chapter || s.chapter === chapter);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
      <Kicker>Timeline</Kicker>
      <Text style={{ fontSize: 24, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginBottom: 16 }}>See how far you've come.</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        {[
          ['Focused time', `${S.focusMinutes} min`, 'Attention invested'],
          ['Story moments', String(S.timeline.length), 'Progress preserved'],
          ['Goals active', String(S.goals.filter(g => g.progress > 20).length), 'In motion'],
        ].map(([label, value, desc]) => (
          <Glass key={label} style={{ flex: 1, padding: 12 }}>
            <Kicker color={C.muted} style={{ fontSize: 8 }}>{label}</Kicker>
            <Text style={{ fontSize: 19, fontWeight: '700', color: C.text }}>{value}</Text>
            <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{desc}</Text>
          </Glass>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }} contentContainerStyle={{ gap: 8 }}>
        {S.chapters.map(ch => {
          const on = ch.id === chapter;
          return (
            <TouchableOpacity key={ch.id} onPress={() => setChapter(ch.id)} style={{
              paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
              borderColor: on ? 'rgba(244,200,66,0.2)' : 'transparent',
              backgroundColor: on ? 'rgba(244,200,66,0.07)' : C.glass,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: on ? C.flare : C.muted }}>{ch.label}</Text>
              <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{ch.range}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => A.openModal('milestone')} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: C.glassBorder, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: C.muted }}>+ Add reflection</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ paddingLeft: 18, borderLeftWidth: 1, borderLeftColor: 'rgba(244,200,66,0.3)' }}>
        {stories.length === 0 && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>This chapter is still being written</Text>
            <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 19 }}>Meaningful work, milestones, and reflections will appear here over time.</Text>
          </View>
        )}
        {stories.map(s => (
          <View key={s.id} style={{ marginBottom: 14 }}>
            <View style={{ position: 'absolute', left: -23, top: 20, width: 10, height: 10, borderRadius: 5, backgroundColor: C.flare, borderWidth: 2, borderColor: C.void }} />
            <Glass style={{ padding: 16, borderRadius: 14 }}>
              <Text style={{ fontSize: 10, color: C.flare, letterSpacing: 0.5, marginBottom: 6 }}>{fmtDate(s.date, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 7 }}>{s.title}</Text>
              <Text style={{ fontSize: 12, color: C.muted, lineHeight: 19 }}>{s.body}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
                {(s.tags || []).map(t => (
                  <View key={t} style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: C.glassBorder }}>
                    <Text style={{ fontSize: 10, color: C.muted }}>{t}</Text>
                  </View>
                ))}
              </View>
            </Glass>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// USER CORE
// ═══════════════════════════════════════════════════════════════════════════
const UserPanel = ({ S, A }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rank = getXPRank(S.user.xp);
  const next = RANKS.find(r => r.min > S.user.xp) || { name: 'Max Rank', min: 10000 };
  const prog = Math.min(100, ((S.user.xp - rank.min) / (next.min - rank.min)) * 100);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
      <Kicker>User Core</Kicker>
      <Text style={{ fontSize: 24, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginBottom: 16 }}>Who are you becoming?</Text>

      <Coachmark id="user" style={{ marginBottom: 16 }} seen={S.seenCoachmarks?.user} onDismiss={() => A.dismissCoachmark('user')} />

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
        <Glass style={{ width: 110, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
          <Ship w={56} h={80} id="profileShip" tier={rankTier(S.user.xp)} />
        </Glass>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Kicker color={C.muted}>Identity Statement</Kicker>
          <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 6 }}>{S.user.name}</Text>
          <Text style={{ fontSize: 13, color: C.muted, lineHeight: 20, marginBottom: 10 }}>{S.identity}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {S.themes.map(t => (
              <View key={t} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.glassBorder }}>
                <Text style={{ fontSize: 11, color: C.muted }}>{t}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => A.openModal('editProfile')} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="edit" size={11} color={C.muted} />
              <Text style={{ fontSize: 12, color: C.muted }}>Edit identity</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <Glass style={{ padding: 18, marginBottom: 14 }}>
        <Kicker color={C.muted}>Growth Snapshot</Kicker>
        <View style={{ backgroundColor: 'rgba(108,99,255,0.08)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: C.drift }}>{S.user.xp}</Text>
          <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Life Experience Points</Text>
        </View>
        <Text style={{ fontSize: 11, color: C.muted, lineHeight: 18, marginBottom: 12 }}>XP isn't a score to optimize. It's a record of how much Aibram has accompanied you through — Focus sessions completed, goals reached, ideas developed, reflections written.</Text>
        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
          <View style={{ height: 6, width: `${prog}%`, backgroundColor: C.pulse, borderRadius: 3 }} />
        </View>
        <Text style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>{rank.name} · {S.user.xp} XP</Text>

        <Text style={{ fontSize: 10, color: C.muted, marginTop: 14, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>Your ship evolves with you</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {RANKS.map((r, i) => {
            const reached = S.user.xp >= r.min;
            const current = rank.name === r.name;
            return (
              <View key={r.name} style={{ alignItems: 'center', opacity: reached ? 1 : 0.28 }}>
                <View style={{ padding: 3, borderRadius: 10, borderWidth: current ? 1 : 0, borderColor: 'rgba(108,99,255,0.5)', backgroundColor: current ? 'rgba(108,99,255,0.1)' : 'transparent' }}>
                  <Ship w={22} h={32} id={`rankShip${i}`} tier={i} />
                </View>
                <Text style={{ fontSize: 7, color: current ? C.drift : C.muted, marginTop: 3, fontWeight: current ? '700' : '400' }}>{r.name}</Text>
              </View>
            );
          })}
        </View>
      </Glass>

      <Glass style={{ padding: 18, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Kicker color={C.muted}>Deep Memory</Kicker>
          {S.isPlus && <Text style={{ fontSize: 10, color: C.muted }}>{S.memoryFacts.length} remembered</Text>}
        </View>
        {!S.isPlus ? (
          <>
            <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18, marginBottom: 12 }}>Free sessions start fresh each time. Aibram+ remembers durable things about you across every conversation — not just chat history, real accumulated understanding.</Text>
            <TouchableOpacity onPress={() => A.setShowPaywall(true)} style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(108,99,255,0.14)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 12, color: C.drift, fontWeight: '700' }}>Unlock Deep Memory</Text>
            </TouchableOpacity>
          </>
        ) : S.memoryFacts.length === 0 ? (
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>Nothing durable yet — as you talk with Aibram, things worth remembering long-term will collect here automatically.</Text>
        ) : (
          <View style={{ gap: 7 }}>
            {[...S.memoryFacts].reverse().slice(0, 8).map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.pulse, marginTop: 6 }} />
                <Text style={{ fontSize: 12, color: '#c9c9dd', lineHeight: 18, flex: 1 }}>{f}</Text>
              </View>
            ))}
            {S.memoryFacts.length > 8 && <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>+{S.memoryFacts.length - 8} more</Text>}
          </View>
        )}
      </Glass>

      <Glass style={{ padding: 18, marginBottom: 14 }}>
        <Kicker color={C.muted}>Account</Kicker>
        <Text style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{auth.currentUser?.email || 'Signed in'}</Text>
        <TouchableOpacity onPress={A.signOutAccount} style={{ paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>Sign out</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setConfirmDelete(true)} style={{ paddingVertical: 11, borderRadius: 11, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: C.red }}>Delete account</Text>
        </TouchableOpacity>
      </Glass>

      {confirmDelete && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)', padding: 28 }}>
            <View style={{ backgroundColor: '#0d0e20', borderRadius: 18, borderWidth: 1, borderColor: C.glassHi, padding: 22, width: '100%' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 }}>Delete your account?</Text>
              <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 19, marginBottom: 18 }}>This permanently removes your account, chat history, and Deep Memory. It can't be undone.</Text>
              <TouchableOpacity onPress={() => { setConfirmDelete(false); A.deleteAccount(); }} style={{ paddingVertical: 12, borderRadius: 12, backgroundColor: C.red, alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: '#fff', fontWeight: '700' }}>Yes, delete everything</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmDelete(false)} style={{ paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: C.muted, fontWeight: '600' }}>Keep my account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Glass style={{ padding: 18, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <Kicker color={C.muted}>Long-term Direction</Kicker>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>Goals</Text>
          </View>
          <TouchableOpacity onPress={() => A.openModal('addGoal')}>
            <Text style={{ fontSize: 11, color: C.muted }}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {S.goals.length === 0 ? (
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>No goals yet. A goal doesn't need to be perfect — just a direction worth aiming at.</Text>
        ) : S.goals.map(g => (
          <View key={g.id} style={{ padding: 12, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 11, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.text }}>{g.title}</Text>
              <Text style={{ fontSize: 10, color: C.muted }}>{g.progress}% · {g.momentum}</Text>
            </View>
            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <View style={{ height: 4, width: `${g.progress}%`, backgroundColor: C.pulse, borderRadius: 2 }} />
            </View>
          </View>
        ))}
      </Glass>

      <Glass style={{ padding: 18, marginBottom: 14 }}>
        <Kicker color={C.muted}>What You're Building</Kicker>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>Active Projects</Text>
        {S.projects.length === 0 ? (
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>Nothing here yet — promote an idea from Space, or add a task and watch it grow into something bigger.</Text>
        ) : S.projects.map(p => (
          <View key={p.id} style={{ padding: 12, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 11, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.text }}>{p.title}</Text>
              <Text style={{ fontSize: 10, color: C.muted }}>{p.progress}%</Text>
            </View>
            <Text style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{p.status} · Next: {p.next}</Text>
            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <View style={{ height: 4, width: `${p.progress}%`, backgroundColor: C.drift, borderRadius: 2 }} />
            </View>
          </View>
        ))}
      </Glass>

      <Glass style={{ padding: 18 }}>
        <Kicker color={C.muted}>Transparent Memory</Kicker>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>What Aibram Understands</Text>
        {S.memories.length === 0 ? (
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>Nothing recorded yet — as you use Aibram, what it picks up on will show up here, in the open.</Text>
        ) : S.memories.map((m, i) => (
          <View key={i} style={{ padding: 12, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 11, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.text, marginBottom: 3 }}>{m.title}</Text>
            <Text style={{ fontSize: 10, color: C.muted }}>{m.source}</Text>
          </View>
        ))}
      </Glass>
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MORNING BRIEF — how the day starts: tasks, weather, and Aibram's voice
// ═══════════════════════════════════════════════════════════════════════════
const currentCycle = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  return 'evening';
};
const CYCLE_META = {
  morning: { label: 'Morning Brief', greeting: 'Good morning', close: 'Start my day →' },
  afternoon: { label: 'Afternoon Check-in', greeting: 'Good afternoon', close: 'Back to it →' },
  evening: { label: 'Evening Wind-down', greeting: 'Good evening', close: 'Rest well →' },
};

const MorningBrief = ({ visible, onClose, S, A, weather }) => {
  const cycle = currentCycle();
  const meta = CYCLE_META[cycle];
  const [message, setMessage] = useState(null);
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMessage(null);
    (async () => {
      const openToday = S.tasks.filter(t => t.date === today() && !t.done);
      const doneToday = S.tasks.filter(t => t.date === today() && t.done);
      const prompt = cycle === 'morning'
        ? `Give ${S.user.name} a 2-3 sentence morning encouragement. Their vibe is ${S.user.vibe}. They have ${openToday.length} tasks today${openToday[0] ? `, the top one being "${openToday[0].title}"` : ''}. Be warm, grounded, specific — no generic hype, no emojis. Speak directly to them.`
        : cycle === 'afternoon'
        ? `Give ${S.user.name} a 2-3 sentence mid-day check-in. They've finished ${doneToday.length} task${doneToday.length !== 1 ? 's' : ''} and have ${openToday.length} still open${openToday[0] ? `, next up "${openToday[0].title}"` : ''}. Their vibe is ${S.user.vibe}. If progress is behind, gently help re-prioritize; if ahead, acknowledge it plainly. No hype, no emojis.`
        : `Give ${S.user.name} a 2-3 sentence evening wind-down. They finished ${doneToday.length} task${doneToday.length !== 1 ? 's' : ''} today${openToday.length > 0 ? ` with ${openToday.length} left open — that's okay` : ''}. Reflect briefly on the day tied to who they're becoming, not tomorrow's to-do list. Calm, grounded, no emojis.`;
      const reply = await callAI(S, [], prompt);
      setMessage(stripMarkdown(reply));
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setNews(null);
    setNewsLoading(true);
    fetchMorningNews(S).then(results => { setNews(results); setNewsLoading(false); });
  }, [visible]);

  if (!visible) return null;
  const openToday = S.tasks.filter(t => t.date === today() && !t.done);
  const doneTodayList = S.tasks.filter(t => t.date === today() && t.done);
  const tomorrowList = [...S.tasks.filter(t => t.date === addDays(1) && !t.done), ...S.events.filter(e => e.date === addDays(1))];
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(2,3,10,0.97)' }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 40 }}>
          <Kicker>{meta.label}</Kicker>
          <Text style={{ fontSize: 30, fontWeight: '700', color: C.text, letterSpacing: -1, marginBottom: 2 }}>{meta.greeting}, {S.user.name}.</Text>
          <Text style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>{dateStr}</Text>

          {cycle === 'morning' && (
          <Glass style={{ padding: 16, marginBottom: 12 }}>
            {weather ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Icon name={weather.icon} size={32} color={C.text} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{weather.temp}°F <Text style={{ fontSize: 13, fontWeight: '400', color: C.muted }}>{weather.label}</Text></Text>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>High {weather.high}° · Low {weather.low}°</Text>
                </View>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: C.muted }}>Weather unavailable — check location permissions.</Text>
            )}
          </Glass>
          )}

          <Glass style={{ padding: 16, marginBottom: 12, borderColor: 'rgba(108,99,255,0.25)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AibramOrb size={30} />
              <Kicker style={{ marginBottom: 0 }}>From Aibram</Kicker>
            </View>
            {message
              ? <Text style={{ fontSize: 13, color: '#cfcfe4', lineHeight: 21 }}>{message}</Text>
              : <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}><PulseDot /><Text style={{ fontSize: 12, color: C.muted }}>Aibram is thinking about your day...</Text></View>}
          </Glass>

          <Glass style={{ padding: 16, marginBottom: 12 }}>
            {cycle === 'evening' ? (<>
              <Kicker color={C.muted}>Today · {doneTodayList.length} done{openToday.length > 0 ? ` · ${openToday.length} carried` : ''}</Kicker>
              {doneTodayList.length === 0 ? (
                <Text style={{ fontSize: 13, color: C.muted }}>Nothing checked off today — some days are for recovering, not producing.</Text>
              ) : doneTodayList.slice(0, 4).map(t => (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
                  <Text style={{ fontSize: 11, color: C.nova }}>✓</Text>
                  <Text style={{ fontSize: 13, color: C.text, flex: 1 }}>{t.title}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ fontSize: 11, color: C.muted }}>{getXPRank(S.user.xp).name} · {S.user.xp} XP</Text>
                <Text style={{ fontSize: 11, color: C.muted }}>{S.user.streak}-day streak</Text>
              </View>
              {tomorrowList.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700', marginBottom: 5 }}>Tomorrow holds</Text>
                  {tomorrowList.slice(0, 2).map(t => <Text key={t.id} style={{ fontSize: 12, color: C.muted, paddingVertical: 2 }}>· {t.title}{t.time ? ` — ${t.time}` : ''}</Text>)}
                </View>
              )}
            </>) : (<>
              <Kicker color={C.muted}>{cycle === 'afternoon' ? `Progress · ${doneTodayList.length} done, ${openToday.length} open` : `Today · ${openToday.length} open`}</Kicker>
              {openToday.length === 0 ? (
                <Text style={{ fontSize: 13, color: C.muted }}>{cycle === 'afternoon' ? 'Everything cleared — strong day.' : 'Nothing scheduled — a rare open sky. Use it deliberately.'}</Text>
              ) : openToday.slice(0, 4).map(t => (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: { high: C.red, medium: C.orange, low: C.pulse }[t.priority] || C.pulse }} />
                  <Text style={{ fontSize: 13, color: C.text, flex: 1 }}>{t.title}</Text>
                  {t.time ? <Text style={{ fontSize: 11, color: C.muted }}>{t.time}</Text> : null}
                </View>
              ))}
              {openToday.length > 4 && <Text style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>+{openToday.length - 4} more in Planning</Text>}
            </>)}
          </Glass>

          <Glass style={{ padding: 16, marginBottom: 20 }}>
            <Kicker color={C.muted}>Your World</Kicker>
            {!AIBRAM_NEWS_URL ? (
              <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18, opacity: 0.75 }}>Personalized news from around you and your interests lands here soon — powered by live search.</Text>
            ) : newsLoading ? (
              <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}><PulseDot /><Text style={{ fontSize: 12, color: C.muted }}>Pulling what's happening today...</Text></View>
            ) : news && news.length > 0 ? (
              <View style={{ gap: 10 }}>
                {news.map((n, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, paddingBottom: i < news.length - 1 ? 10 : 0, borderBottomWidth: i < news.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                    {n.image ? (
                      <Image source={{ uri: n.image }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }} resizeMode="cover" />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.text, marginBottom: 3 }}>{n.title}</Text>
                      {/* Full summary shown, not truncated to a couple lines — real */}
                      {/* condensation still needs a Claude summarization pass added */}
                      {/* server-side in getMorningNews; this just stops clipping it. */}
                      {n.snippet ? <Text style={{ fontSize: 11, color: C.muted, lineHeight: 16 }}>{n.snippet}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>Nothing pulled this time — try again from here shortly.</Text>
            )}
          </Glass>

          <TouchableOpacity onPress={onClose} style={{ backgroundColor: C.pulse, borderRadius: 14, padding: 15, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{meta.close}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYWALL — real RevenueCat: loads your actual offering, purchases for real
// ═══════════════════════════════════════════════════════════════════════════
const Paywall = ({ visible, onClose, onPurchase }) => {
  const [pkgs, setPkgs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadError(false);
    if (!Purchases) { setLoadError(true); return; }
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const offering = RC_OFFERING_ID ? offerings.all[RC_OFFERING_ID] : offerings.current;
        const available = offering?.availablePackages || [];
        setPkgs(available);
        setSelected(available[0] || null);
        if (available.length === 0) setLoadError(true);
      } catch (e) {
        console.log('Failed to load RevenueCat offerings:', e);
        setLoadError(true);
      }
    })();
  }, [visible]);

  const purchase = async () => {
    if (!selected || !Purchases) return;
    setBusy(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selected);
      setBusy(false);
      if (customerInfo.entitlements.active[RC_ENTITLEMENT_ID]) onPurchase();
    } catch (e) {
      setBusy(false);
      if (!e.userCancelled) Alert.alert('Purchase failed', e.message || 'Something went wrong. Try again.');
    }
  };

  const restore = async () => {
    if (!Purchases) return;
    setBusy(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      setBusy(false);
      if (customerInfo.entitlements.active[RC_ENTITLEMENT_ID]) {
        onPurchase();
      } else {
        Alert.alert('Nothing to restore', 'No active Aibram+ purchase was found for this account.');
      }
    } catch (e) {
      setBusy(false);
      Alert.alert('Restore failed', e.message || 'Something went wrong. Try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(2,3,10,0.9)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ width: '100%', maxWidth: 460, backgroundColor: 'rgba(12,13,26,0.99)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', borderRadius: 24, overflow: 'hidden' }}>
          <ScrollView style={{ maxHeight: SH * 0.85 }}>
            <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
              <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
            <View style={{ backgroundColor: 'rgba(108,99,255,0.1)', padding: 28, paddingTop: 32, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(108,99,255,0.15)' }}>
              <Ship w={52} h={76} id="rcShip" />
              <Text style={{ fontSize: 24, fontWeight: '700', color: C.text, marginTop: 14 }}>Aibram<Text style={{ color: C.drift }}>+</Text></Text>
              <Text style={{ fontSize: 14, color: C.muted, lineHeight: 21, textAlign: 'center', marginTop: 8 }}>Give Aibram the full picture. Unlock everything that makes the Life OS complete.</Text>
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              {[
                ['Deep Memory — Aibram remembers your conversations across sessions, not just your day', 'AI+'],
                ['Document Intelligence — attach PDFs and images, Aibram reads and works through them with you', 'AI+'],
                ['No ads — ever', null],
              ].map(([text, badge]) => (
                <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(108,99,255,0.15)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: C.drift, fontSize: 10 }}>✓</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: C.text, flex: 1 }}>{text}</Text>
                  {badge && (
                    <View style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)' }}>
                      <Text style={{ fontSize: 9, color: C.drift }}>{badge}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <View style={{ paddingHorizontal: 24 }}>
              {loadError && (
                <Text style={{ fontSize: 12, color: C.orange, textAlign: 'center', marginBottom: 12, lineHeight: 18 }}>
                  Couldn't load your RevenueCat offering. Check REVENUECAT_API_KEY, RC_ENTITLEMENT_ID, and that products are Ready to Submit in App Store Connect — and remember this needs a dev build, not Expo Go.
                </Text>
              )}
              {pkgs.map(pkg => {
                const on = selected?.identifier === pkg.identifier;
                return (
                  <TouchableOpacity key={pkg.identifier} onPress={() => setSelected(pkg)} style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: on ? 'rgba(108,99,255,0.14)' : 'rgba(108,99,255,0.08)',
                    borderWidth: 1, borderColor: on ? 'rgba(108,99,255,0.6)' : 'rgba(108,99,255,0.25)',
                    borderRadius: 14, padding: 16, marginBottom: 10,
                  }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{pkg.product.title || pkg.packageType}</Text>
                      <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }} numberOfLines={2}>{pkg.product.description || 'Billed via your app store · cancel anytime'}</Text>
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: C.drift, flexShrink: 0 }}>{pkg.product.priceString}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ padding: 24, paddingTop: 8 }}>
              <TouchableOpacity onPress={purchase} disabled={busy || !selected} style={{ backgroundColor: C.pulse, borderRadius: 14, padding: 15, alignItems: 'center', opacity: busy || !selected ? 0.6 : 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{busy ? 'Processing...' : selected ? `Start Aibram+ — ${selected.product.priceString}` : 'Loading plans...'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={restore} disabled={busy} style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: C.muted }}>Restore purchases</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center', opacity: 0.6, lineHeight: 15 }}>By continuing you agree to our Terms of Service. Subscriptions auto-renew unless cancelled 24hrs before renewal. Managed via the App Store.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC FORM MODALS — addNode · addGoal · editProfile · milestone · addSpend · budgets
// ═══════════════════════════════════════════════════════════════════════════
const Field = ({ label, children }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted, marginBottom: 8, fontWeight: '700' }}>{label}</Text>
    {children}
  </View>
);
const MInput = (props) => (
  <TextInput placeholderTextColor={C.muted} {...props} style={[{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12, padding: 12, color: C.text, fontSize: 14 }, props.style]} />
);
const MSelect = ({ options, value, onSelect }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
    {options.map(o => (
      <TouchableOpacity key={o} onPress={() => onSelect(o)} style={{
        paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1,
        borderColor: value === o ? 'rgba(108,99,255,0.5)' : C.glassBorder,
        backgroundColor: value === o ? 'rgba(108,99,255,0.12)' : 'transparent',
      }}>
        <Text style={{ fontSize: 12, color: value === o ? C.drift : C.muted }}>{o}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const FormModal = ({ modal, onClose, S, A }) => {
  const [f, setF] = useState({});
  useEffect(() => {
    if (modal === 'editProfile') setF({ name: S.user.name, identity: S.identity, themes: S.themes.join(', ') });
    else if (modal === 'budgets') {
      const b = {};
      SPEND_CATS.forEach(c => b[c] = String(S.budgets[c]?.limit ?? 50));
      setF(b);
    } else setF({ type: 'idea', category: 'Food', chapter: S.chapters[0]?.id, date: today() });
  }, [modal]);

  if (!modal) return null;
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const titles = { addNode: 'Add a Node to Space', addGoal: 'Add a Long-term Goal', editProfile: 'Edit Your Identity', milestone: 'Add a Reflection', addSpend: 'Log a Transaction', budgets: 'Edit Budget Limits' };

  const save = () => {
    if (modal === 'addNode') {
      if (!f.title?.trim()) return;
      A.addNode(f.type || 'idea', f.title.trim(), f.body?.trim() || 'An idea waiting for more context.');
    } else if (modal === 'addGoal') {
      if (!f.title?.trim()) return;
      A.addGoal(f.title.trim());
    } else if (modal === 'editProfile') {
      A.saveProfile(f.name?.trim(), f.identity?.trim(), (f.themes || '').split(',').map(t => t.trim()).filter(Boolean));
    } else if (modal === 'milestone') {
      if (!f.text?.trim()) return;
      A.addMilestone(f.text.trim(), f.chapter);
    } else if (modal === 'addSpend') {
      const amount = parseFloat(f.amount);
      if (!amount || amount <= 0) { A.toast('Enter a valid amount.'); return; }
      if (!f.note?.trim()) { A.toast('Add a quick note so you remember what this was.'); return; }
      A.addTransaction(amount, f.category, f.note.trim(), f.date || today());
    } else if (modal === 'budgets') {
      const updates = {};
      SPEND_CATS.forEach(c => { const v = parseFloat(f[c]); if (!isNaN(v) && v >= 0) updates[c] = v; });
      A.saveBudgets(updates);
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(2,3,9,0.8)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ width: '100%', maxWidth: 520, backgroundColor: 'rgba(12,13,26,0.99)', borderWidth: 1, borderColor: C.glassHi, borderRadius: 22, padding: 22, maxHeight: SH * 0.85 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: C.text }}>{titles[modal]}</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {modal === 'addNode' && (<>
              <Field label="Node Type"><MSelect options={['idea', 'question', 'principle', 'goal', 'research', 'project', 'story']} value={f.type} onSelect={v => set('type', v)} /></Field>
              <Field label="Title"><MInput value={f.title || ''} onChangeText={v => set('title', v)} placeholder="Name the thought" /></Field>
              <Field label="What's here?"><MInput value={f.body || ''} onChangeText={v => set('body', v)} placeholder="Capture enough context to return later" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} /></Field>
            </>)}
            {modal === 'addGoal' && (
              <Field label="Desired future"><MInput value={f.title || ''} onChangeText={v => set('title', v)} placeholder="What future are you working toward?" /></Field>
            )}
            {modal === 'editProfile' && (<>
              <Field label="Your Name"><MInput value={f.name || ''} onChangeText={v => set('name', v)} /></Field>
              <Field label="Who are you becoming?"><MInput value={f.identity || ''} onChangeText={v => set('identity', v)} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} /></Field>
              <Field label="Focus Themes (comma separated)"><MInput value={f.themes || ''} onChangeText={v => set('themes', v)} /></Field>
            </>)}
            {modal === 'milestone' && (<>
              <Field label="What became clearer?"><MInput value={f.text || ''} onChangeText={v => set('text', v)} placeholder="A lesson, milestone, challenge, or moment worth preserving" multiline style={{ minHeight: 80, textAlignVertical: 'top' }} /></Field>
              <Field label="Chapter"><MSelect options={S.chapters.map(c => c.id)} value={f.chapter} onSelect={v => set('chapter', v)} /></Field>
            </>)}
            {modal === 'addSpend' && (<>
              <Field label="Amount ($)"><MInput value={f.amount || ''} onChangeText={v => set('amount', v)} placeholder="0.00" keyboardType="decimal-pad" style={{ fontSize: 18, fontWeight: '700' }} /></Field>
              <Field label="Category"><MSelect options={SPEND_CATS} value={f.category} onSelect={v => set('category', v)} /></Field>
              <Field label="What was it for?"><MInput value={f.note || ''} onChangeText={v => set('note', v)} placeholder="e.g. Whataburger, gas, groceries..." /></Field>
            </>)}
            {modal === 'budgets' && (<>
              <Text style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Set your weekly spending limits per category.</Text>
              {SPEND_CATS.map(cat => (
                <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <View style={{ width: 26 }}><Icon name={SPEND_ICONS[cat]} size={15} color={C.muted} /></View>
                  <Text style={{ fontSize: 13, flex: 1, fontWeight: '600', color: C.text }}>{cat}</Text>
                  <Text style={{ fontSize: 12, color: C.muted }}>$</Text>
                  <TextInput value={f[cat] || ''} onChangeText={v => set(cat, v)} keyboardType="number-pad"
                    style={{ width: 70, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.glassBorder, borderRadius: 8, padding: 7, color: C.text, fontSize: 13, textAlign: 'right' }} />
                </View>
              ))}
            </>)}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <TouchableOpacity onPress={onClose} style={{ paddingVertical: 11, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} style={{ paddingVertical: 11, paddingHorizontal: 22, borderRadius: 999, backgroundColor: C.pulse }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP — all state + actions + nav
// ═══════════════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'planning', icon: 'planning', label: 'Plan' },
  { key: 'aibram', icon: 'aibram', label: 'Aibram' },
  { key: 'focus', icon: 'focus', label: 'Focus' },
  { key: 'space', icon: 'space', label: 'Space' },
  { key: 'user', icon: 'user', label: 'You' },
];

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  const [booting, setBooting] = useState(true);

  // Onboarding should only ever run once per ACCOUNT, not once per device —
  // the flag is keyed by the signed-in user's UID so a second, genuinely
  // new account on the same device (e.g. an App Review demo account) still
  // sees onboarding, instead of inheriting whichever account tested it last.
  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise(r => setTimeout(r, 700)); // keep the branded boot moment even on a fast check
    const uid = auth.currentUser?.uid;
    const key = uid ? `aibram_onboarding_complete_${uid}` : null;
    const check = key ? AsyncStorage.getItem(key) : Promise.resolve(null);
    Promise.all([check, minDelay]).then(([done]) => {
      if (cancelled) return;
      if (done === 'true') setScreen('app');
      setBooting(false);
    });
    return () => { cancelled = true; };
  }, []);
  const [panel, setPanel] = useState('home');
  const [user, setUser] = useState({ name: 'Explorer', xp: 0, streak: 0, vibe: 'Steady', ageBracket: null });
  const [memoryFacts, setMemoryFacts] = useState([]);
  const [identity, setIdentity] = useState('Figuring out what matters, one day at a time.');
  const [themes, setThemes] = useState([]);
  const [tasks, setTasks] = useState(initialTasks);
  const [events, setEvents] = useState(initialEvents);
  const [nodes, setNodes] = useState(initialNodes);
  const [connections, setConnections] = useState(initialConnections);
  const [goals, setGoals] = useState(initialGoals);
  const [projects] = useState(initialProjects);
  const [memories] = useState(initialMemories);
  const [chapters] = useState(initialChapters);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [chat, setChat] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [focusSessions, setFocusSessions] = useState(0);
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [isPlus, setIsPlus] = useState(false);
  const [modal, setModal] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [observerInsight, setObserverInsight] = useState(null);
  const [pendingAibramMsg, setPendingAibramMsg] = useState(null);
  const [nodePositions, setNodePositions] = useState(graphPos);
  const [aibramNotice, setAibramNotice] = useState(false);
  const [weather, setWeather] = useState(null);
  const [quote, setQuote] = useState(null);
  const [morningVisible, setMorningVisible] = useState(false);
  const morningShownRef = useRef(false);
  const [spaceHint, setSpaceHint] = useState(null);
  const [justConnected, setJustConnected] = useState([]);
  const [dismissedHints, setDismissedHints] = useState([]);
  const [seenCoachmarks, setSeenCoachmarks] = useState({});
  useEffect(() => {
    AsyncStorage.getItem('aibram_seen_coachmarks').then(raw => {
      if (raw) { try { setSeenCoachmarks(JSON.parse(raw)); } catch (e) {} }
    });
  }, []);
  const dismissCoachmark = (id) => {
    setSeenCoachmarks(prev => {
      const next = { ...prev, [id]: true };
      AsyncStorage.setItem('aibram_seen_coachmarks', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const toastTimer = useRef(null);
  const noticeTimer = useRef(null);
  const liveRef = useRef({});
  useEffect(() => { liveRef.current = { tasks, nodes, connections, spaceHint, dismissedHints }; });

  const runObserver = () => {
    const L = liveRef.current;
    const overdue = L.tasks.filter(t => t.date < today() && !t.done);
    const doneToday = L.tasks.filter(t => t.date === today() && t.done);

    let msg = null;
    if (overdue.length > 0) {
      msg = `${overdue.length} task${overdue.length > 1 ? 's' : ''} from earlier ${overdue.length > 1 ? 'are' : 'is'} still open — "${overdue[0].title}". Worth clearing before they pile up.`;
    } else if (doneToday.length > 0 && Math.random() < 0.4) {
      const last = doneToday[doneToday.length - 1];
      msg = `✓ "${last.title}" done. That one mattered — nice work.`;
    }
    if (msg) {
      setObserverInsight(msg);
      setAibramNotice(true);
      clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setAibramNotice(false), 6000);
    }

    if (!L.spaceHint) {
      const connectedIds = new Set(L.connections.flat());
      const isolated = L.nodes.filter(n => !connectedIds.has(n.id));
      let best = null;
      for (const a of isolated) {
        for (const b of L.nodes) {
          if (a.id === b.id) continue;
          const already = L.connections.some(c => (c[0] === a.id && c[1] === b.id) || (c[1] === a.id && c[0] === b.id));
          if (already) continue;
          const key = [a.id, b.id].sort().join('|');
          if (L.dismissedHints.includes(key)) continue;
          const score = nodeRelatedness(a, b);
          if (score > 0 && (!best || score > best.score)) best = { a: a.id, b: b.id, score };
        }
      }
      if (best) setSpaceHint(best);
    }
  };

  useEffect(() => {
    if (screen !== 'app') return;
    const initial = setTimeout(runObserver, 3500);
    const interval = setInterval(runObserver, 26000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [screen]);

  useEffect(() => {
    if (screen !== 'app') return;
    fetchWeather().then(w => { if (w) setWeather(w); });
    fetchQuoteOfDay().then(q => { if (q) setQuote(q); });
    if (!morningShownRef.current && currentCycle() === 'morning') {
      morningShownRef.current = true;
      const t = setTimeout(() => setMorningVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, [screen]);

  const acceptSpaceHint = () => {
    if (!spaceHint) return;
    setConnections(prev => [...prev, [spaceHint.a, spaceHint.b]]);
    setJustConnected([spaceHint.a, spaceHint.b]);
    setTimeout(() => setJustConnected([]), 2200);
    toast('Connection made. Aibram linked them because they share context.');
    setSpaceHint(null);
  };
  const dismissSpaceHint = () => {
    if (spaceHint) setDismissedHints(prev => [...prev, [spaceHint.a, spaceHint.b].sort().join('|')]);
    setSpaceHint(null);
  };
  const setNodePosition = (id, pos) => setNodePositions(prev => ({ ...prev, [id]: pos }));
  const setAllNodePositions = (posMap) => setNodePositions(posMap);

  const toast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  };

  const addXP = (n) => setUser(u => ({ ...u, xp: u.xp + n }));

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const done = !t.done;
      if (done) {
        addXP(50);
        if (t.priority === 'high') {
          setTimeline(tl => [{
            id: 'auto_' + Date.now(), date: today(), chapter: 'Building Aibram',
            title: t.title, body: 'Completed a meaningful commitment. The work moved from intention into the story of progress.',
            tags: [t.project || 'Progress', 'Completed work'],
          }, ...tl]);
          toast('✓ Task completed. Aibram will remember this.');
        } else {
          toast('✓ Task completed. +50 XP');
        }
      }
      return { ...t, done };
    }));
    setTimeout(runObserver, 900);
  };

  const addTask = (title, opts = {}) => {
    setTasks(prev => [...prev, {
      id: 't' + Date.now(), title,
      date: opts.date || selectedDate, time: opts.time || null,
      project: opts.project || 'Quick capture', priority: opts.priority || 'low', done: false,
    }]);
    toast('Commitment added.');
    setTimeout(runObserver, 900);
  };

  const addEvent = (title, date, time, opts = {}) => {
    if (opts.repeatWeekly) {
      const base = new Date((date || selectedDate) + 'T00:00:00');
      const batch = Array.from({ length: 8 }, (_, i) => {
        const d = new Date(base); d.setDate(base.getDate() + i * 7);
        return { id: 'e' + Date.now() + '_' + i, title, date: d.toISOString().split('T')[0], time: time || null, location: opts.location || null, recurring: true };
      });
      setEvents(prev => [...prev, ...batch]);
      toast('Scheduled — repeats weekly for 8 weeks.');
      return;
    }
    setEvents(prev => [...prev, { id: 'e' + Date.now(), title, date: date || selectedDate, time: time || null, location: opts.location || null }]);
    toast('Scheduled.');
  };
  const updateEvent = (id, patch) => setEvents(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteEvent = (id) => { setEvents(prev => prev.filter(e => e.id !== id)); toast('Event removed.'); };
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const deleteTask = (id) => { setTasks(prev => prev.filter(t => t.id !== id)); toast('Commitment removed.'); };

  const addNode = (type, title, body) => {
    const colorMap = { idea: '167,139,250', question: '244,200,66', principle: '74,222,128', goal: '101,167,255', research: '108,99,255', project: '101,167,255', story: '244,200,66' };
    const id = 'n' + Date.now();
    setNodes(prev => [...prev, { id, type, title, body, color: colorMap[type] || '167,139,250' }]);
    setNodePositions(prev => ({ ...prev, [id]: { x: 15 + Math.random() * 70, y: 15 + Math.random() * 65 } }));
    toast('The thought has a place. Structure can come later.');
    setTimeout(runObserver, 1200);
  };

  const updateNodeBody = (id, body) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, body } : n));
  };

  const togglePinNode = (id) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const quickCapture = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const isQuestion = trimmed.endsWith('?');
    const words = trimmed.split(/\s+/);
    const title = words.slice(0, 7).join(' ') + (words.length > 7 ? '…' : '');
    addNode(isQuestion ? 'question' : 'idea', title, trimmed);
  };

  const deleteNode = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(([a, b]) => a !== id && b !== id));
    setNodePositions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast('Idea removed.');
  };

  const promoteNodeToTask = (n) => {
    setTasks(prev => [...prev, { id: 't' + Date.now(), title: `Move forward: ${n.title}`, date: today(), time: null, project: n.type === 'project' ? n.title : 'Space', priority: 'medium', done: false }]);
    toast('The idea became a commitment in Planning.');
  };

  const askAboutNode = (n) => {
    setPanel('aibram');
    setPendingAibramMsg(`I'm looking at "${n.title}" in Space. Help me think through it deeper.`);
  };

  const addGoal = (title) => {
    setGoals(prev => [...prev, { id: 'g' + Date.now(), title, progress: 4, momentum: 'Beginning' }]);
    toast('Goal added as a direction, not a checklist.');
  };

  const saveProfile = (name, id, th) => {
    if (name) setUser(u => ({ ...u, name }));
    if (id) setIdentity(id);
    if (th?.length) setThemes(th);
    toast('Your User Core evolved with you.');
  };

  const addMilestone = (text, chapter) => {
    setTimeline(prev => [{ id: 's' + Date.now(), date: today(), chapter, title: 'A moment worth preserving', body: text, tags: ['Reflection'] }, ...prev]);
    toast('Reflection added to your story.');
  };

  const addTransaction = (amount, category, note, date) => {
    setTransactions(prev => [{ id: 'sp' + Date.now(), date, amount, category, note, icon: SPEND_ICONS[category] || 'package' }, ...prev]);
    setObserverInsight(`New transaction: $${amount.toFixed(2)} on ${category}.`);
    toast(`$${amount.toFixed(2)} logged under ${category}.`);
  };

  const deleteTransaction = (id) => setTransactions(prev => prev.filter(t => t.id !== id));

  const saveBudgets = (updates) => {
    setBudgets(prev => {
      const next = { ...prev };
      Object.entries(updates).forEach(([cat, limit]) => { next[cat] = { ...next[cat], limit, icon: SPEND_ICONS[cat] }; });
      return next;
    });
    toast('Budgets updated.');
  };

  const finishFocus = (elapsedMin) => {
    setFocusMinutes(m => m + elapsedMin);
    setFocusSessions(s => s + 1);
    addXP(50);
  };

  const saveFocusReflection = (text, task) => {
    setTimeline(prev => [{
      id: 'focus_' + Date.now(), date: today(),
      chapter: task?.project === 'College' ? 'College' : 'Building Aibram',
      title: `Focused work: ${task?.title || 'Open session'}`,
      body: text || 'Protected attention for one meaningful commitment and moved it forward.',
      tags: ['Focus', task?.project || 'Progress'],
    }, ...prev]);
    toast('Aibram will remember this session.');
  };

  const setVibe = (v) => setUser(u => ({ ...u, vibe: v }));

  const purchasePlus = () => {
    setIsPlus(true);
    setShowPaywall(false);
    setChat(prev => prev.filter(m => m.role !== 'ad'));
    addXP(100);
    toast('✦ Welcome to Aibram+. Ads removed. Full access unlocked.');
  };

  useEffect(() => {
    if (mobileAds) mobileAds().initialize().catch(e => console.log('AdMob init failed:', e));
    if (!REVENUECAT_API_KEY || !Purchases) return;
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    if (auth.currentUser) Purchases.logIn(auth.currentUser.uid).catch(() => {});
    Purchases.getCustomerInfo()
      .then(info => {
        if (info.entitlements.active[RC_ENTITLEMENT_ID]) setIsPlus(true);
      })
      .catch(e => console.log('RevenueCat getCustomerInfo failed:', e));
  }, []);

  const chatLoadedRef = useRef(false);
  useEffect(() => {
    if (!isPlus || !auth.currentUser || chatLoadedRef.current) return;
    chatLoadedRef.current = true;
    (async () => {
      try {
        const snap = await getDoc(doc(getFirestore(), 'users', auth.currentUser.uid, 'aibram', 'chatHistory'));
        if (snap.exists()) {
          const saved = snap.data().messages || [];
          if (saved.length > 0) setChat(saved);
        }
      } catch (e) { console.log('Deep Memory load failed:', e); }
    })();
  }, [isPlus]);

  useEffect(() => {
    if (!isPlus || !auth.currentUser || !chatLoadedRef.current) return;
    const t = setTimeout(() => {
      setDoc(doc(getFirestore(), 'users', auth.currentUser.uid, 'aibram', 'chatHistory'), {
        messages: chat.filter(m => m.role === 'user' || m.role === 'assistant').slice(-60),
        updated: Date.now(),
      }).catch(e => console.log('Deep Memory save failed:', e));
    }, 1200);
    return () => clearTimeout(t);
  }, [chat, isPlus]);

  const memoryLoadedRef = useRef(false);
  useEffect(() => {
    if (!isPlus || !auth.currentUser || memoryLoadedRef.current) return;
    memoryLoadedRef.current = true;
    (async () => {
      try {
        const snap = await getDoc(doc(getFirestore(), 'users', auth.currentUser.uid, 'aibram', 'memoryProfile'));
        if (snap.exists()) {
          const saved = snap.data().facts || [];
          if (saved.length > 0) setMemoryFacts(saved);
        }
      } catch (e) { console.log('Memory profile load failed:', e); }
    })();
  }, [isPlus]);

  useEffect(() => {
    if (!isPlus || !auth.currentUser || !memoryLoadedRef.current) return;
    const t = setTimeout(() => {
      setDoc(doc(getFirestore(), 'users', auth.currentUser.uid, 'aibram', 'memoryProfile'), {
        facts: memoryFacts.slice(-60),
        updated: Date.now(),
      }).catch(e => console.log('Memory profile save failed:', e));
    }, 1200);
    return () => clearTimeout(t);
  }, [memoryFacts, isPlus]);

  const addMemoryFacts = (newFacts) => {
    if (!Array.isArray(newFacts) || newFacts.length === 0) return;
    setMemoryFacts(prev => {
      const lower = new Set(prev.map(f => f.toLowerCase()));
      const additions = newFacts.filter(f => typeof f === 'string' && f.trim() && !lower.has(f.trim().toLowerCase()));
      if (additions.length === 0) return prev;
      return [...prev, ...additions.map(f => f.trim())].slice(-60);
    });
  };

  // ── APP STATE PERSISTENCE — tasks, events, Space, goals, spending, timeline ──
  // Previously these all lived only in React state and vanished on app close.
  // This mirrors the exact load/save pattern already used above for chat and
  // memoryFacts, but applies to every user (not gated behind isPlus) since
  // losing your tasks isn't a premium-only problem.
  const appStateLoadedRef = useRef(false);
  const [appStateReady, setAppStateReady] = useState(false);
  useEffect(() => {
    if (!auth.currentUser || appStateLoadedRef.current) return;
    appStateLoadedRef.current = true;
    (async () => {
      try {
        const snap = await getDoc(doc(getFirestore(), 'users', auth.currentUser.uid, 'aibram', 'appState'));
        if (snap.exists()) {
          const d = snap.data();
          if (d.tasks) setTasks(d.tasks);
          if (d.events) setEvents(d.events);
          if (d.nodes) setNodes(d.nodes);
          if (d.connections) setConnections(d.connections);
          if (d.goals) setGoals(d.goals);
          if (d.transactions) setTransactions(d.transactions);
          if (d.budgets) setBudgets(d.budgets);
          if (d.timeline) setTimeline(d.timeline);
          if (d.nodePositions) setNodePositions(d.nodePositions);
          if (d.identity) setIdentity(d.identity);
          if (d.themes) setThemes(d.themes);
          if (d.user) setUser(u => ({ ...u, ...d.user }));
          if (typeof d.focusSessions === 'number') setFocusSessions(d.focusSessions);
          if (typeof d.focusMinutes === 'number') setFocusMinutes(d.focusMinutes);
        }
      } catch (e) {
        console.log('App state load failed:', e);
      } finally {
        setAppStateReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!appStateReady || !auth.currentUser) return;
    const t = setTimeout(() => {
      setDoc(doc(getFirestore(), 'users', auth.currentUser.uid, 'aibram', 'appState'), {
        tasks, events, nodes, connections, goals, transactions, budgets, timeline, nodePositions,
        identity, themes, user, focusSessions, focusMinutes,
        updated: Date.now(),
      }).catch(e => console.log('App state save failed:', e));
    }, 1200);
    return () => clearTimeout(t);
  }, [tasks, events, nodes, connections, goals, transactions, budgets, timeline, nodePositions, identity, themes, user, focusSessions, focusMinutes, appStateReady]);

  const signOutAccount = async () => {
    try { await signOut(auth); } catch (e) { console.log('Sign out failed:', e); }
    setChat([]); setMemoryFacts([]);
    memoryLoadedRef.current = false; chatLoadedRef.current = false;
    appStateLoadedRef.current = false; setAppStateReady(false);
    morningShownRef.current = false;
  };
  const deleteAccount = async () => {
    try {
      const u = auth.currentUser;
      if (u) await deleteUser(u);
    } catch (e) {
      console.log('Delete account failed:', e);
      toast('Please sign in again, then delete — for security.');
    }
    setChat([]); setMemoryFacts([]);
    memoryLoadedRef.current = false; chatLoadedRef.current = false;
    appStateLoadedRef.current = false; setAppStateReady(false);
    morningShownRef.current = false;
  };

  const clearChat = () => setChat([]);
  const pushChat = (m) => setChat(prev => [...prev, m]);
  const resolveAction = (actionId, status) => {
    setChat(prev => prev.map(m => (m.role === 'action' && m.actionId === actionId) ? { ...m, status } : m));
  };

  useEffect(() => {
    if (screen === 'app' && panel === 'aibram' && chat.length === 0) {
      const open = tasks.filter(t => t.date === today() && !t.done);
      const top = open.find(t => t.priority === 'high') || open[0];
      pushChat({
        role: 'assistant',
        content: top
          ? `"${top.title}" looks like the clearest priority today. I can help you plan it, think it through, or just talk through whatever's actually on your mind.`
          : `Your day is open. I can help you plan, think, or just figure out where to start — whatever's useful.`,
      });
    }
  }, [screen, panel]);

  const S = { user, identity, themes, tasks, events, nodes, connections, goals, projects, memories, chapters, timeline, transactions, budgets, chat, selectedDate, focusSessions, focusMinutes, isPlus, observerInsight, nodePositions, aibramNotice, spaceHint, justConnected, weather, quote, memoryFacts, seenCoachmarks };
  const A = {
    setPanel, setVibe, toggleTask, addTask, addEvent, updateEvent, deleteEvent, updateTask, deleteTask, addNode, deleteNode, promoteNodeToTask, askAboutNode,
    addGoal, saveProfile, addMilestone, addTransaction, deleteTransaction, saveBudgets,
    finishFocus, saveFocusReflection, setSelectedDate, setConnections,
    setShowPaywall,
    openModal: setModal, toast, addXP, clearChat, pushChat, resolveAction, signOutAccount, deleteAccount,
    setNodePosition, acceptSpaceHint, dismissSpaceHint,
    updateNodeBody, togglePinNode, quickCapture, setAllNodePositions, addMemoryFacts,
    openMorningBrief: () => setMorningVisible(true),
    dismissCoachmark,
  };

  const AibramWithPending = () => {
    useEffect(() => {
      if (pendingAibramMsg) {
        const msg = pendingAibramMsg;
        setPendingAibramMsg(null);
        (async () => {
          pushChat({ role: 'user', content: msg });
          const { text: reply, toolUses, rawContent } = await callAIWithTools(S, chat, msg);
          if (LAST_AI_ERROR) toast(`Aibram is offline: ${LAST_AI_ERROR}`);
          const { cleanText, steps, chart, memoryFacts: newFacts } = parseAibramBlocks(reply);
          if (cleanText || steps || chart) pushChat({ role: 'assistant', content: cleanText, steps, chart });
          if (isPlus && newFacts) addMemoryFacts(newFacts);
          const turnId = 'turn' + Date.now() + Math.random().toString(36).slice(2, 6);
          toolUses.forEach(tu => {
            pushChat({ role: 'action', tool: tu.name, input: tu.input, toolUseId: tu.id, turnId, rawContent, status: 'pending', actionId: 'act' + Date.now() + Math.random().toString(36).slice(2, 6) });
          });
        })();
      }
    }, []);
    return <AibramPanel S={S} A={A} />;
  };

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: C.void, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor={C.void} />
        <StarField />
        <AibramLoader size={110} label="Loading your universe..." />
      </View>
    );
  }

  if (screen === 'onboarding') {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={C.void} />
        <Onboarding onDone={({ name, vibe, ageBracket, goals: pickedGoals, struggles: pickedStruggles }) => {
          setUser(u => ({ ...u, name, vibe, ageBracket: ageBracket || u.ageBracket }));
          // Turn onboarding answers into real profile data instead of
          // discarding them — selected goals become real Goal entries,
          // selected struggles become identity-card theme tags.
          if (Array.isArray(pickedGoals) && pickedGoals.length > 0) {
            setGoals(prev => [...prev, ...pickedGoals.map((title, i) => ({ id: 'g' + Date.now() + '_' + i, title, progress: 2, momentum: 'Just starting' }))]);
          }
          if (Array.isArray(pickedStruggles) && pickedStruggles.length > 0) {
            setThemes(prev => [...new Set([...prev, ...pickedStruggles])]);
          }
          const uid = auth.currentUser?.uid;
          if (uid) AsyncStorage.setItem(`aibram_onboarding_complete_${uid}`, 'true').catch(() => {});
          setScreen('app');
        }} />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.void }}>
      <StatusBar barStyle="light-content" backgroundColor={C.void} />
      <StarField />
      <View style={{ flex: 1, paddingTop: Platform.OS === 'ios' ? 44 : 28 }}>
        {panel === 'home' && <HomePanel S={S} A={A} />}
        {panel === 'planning' && <PlanningPanel S={S} A={A} />}
        {panel === 'aibram' && <AibramWithPending />}
        {panel === 'focus' && <FocusPanel S={S} A={A} />}
        {panel === 'space' && <SpacePanel S={S} A={A} />}
        {panel === 'user' && <UserPanel S={S} A={A} />}
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: 'rgba(5,6,15,0.97)', borderTopWidth: 1, borderTopColor: C.glassBorder, paddingBottom: Platform.OS === 'ios' ? 22 : 10, paddingTop: 8 }}>
        {NAV_ITEMS.map(item => {
          const on = panel === item.key;
          return (
            <TouchableOpacity key={item.key} onPress={() => setPanel(item.key)} style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 2 }}>
              <NavIcon name={item.icon} active={on} size={20} />
              <Text style={{ fontSize: 9, fontWeight: '600', color: on ? C.drift : C.muted }}>{item.label}</Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.pulse, opacity: on ? 1 : 0 }} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} onPurchase={purchasePlus} />
      <MorningBrief visible={morningVisible} onClose={() => setMorningVisible(false)} S={S} A={A} weather={weather} />
      <FormModal modal={modal} onClose={() => setModal(null)} S={S} A={A} />

      {toastMsg && (
        <View style={{ position: 'absolute', left: 30, right: 30, bottom: 100, backgroundColor: 'rgba(19,28,43,0.97)', borderWidth: 1, borderColor: C.glassHi, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: C.text }}>{toastMsg}</Text>
        </View>
      )}
    </View>
  );
}

// ─── SHARED STYLES ──────────────────────────────────────────────────────────
const st = StyleSheet.create({
  calNavBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', justifyContent: 'center' },
  aiInsight: { marginTop: 14, padding: 13, backgroundColor: 'rgba(108,99,255,0.07)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.18)', borderRadius: 12 },
  aiInsightLabel: { fontSize: 9, letterSpacing: 1.5, color: C.pulse, fontWeight: '700', marginBottom: 6 },
  aiInsightText: { fontSize: 12, color: C.muted, lineHeight: 19 },
  focusCtrl: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: C.glassBorder, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' },
  spMini: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  nodeAction: { flex: 1, padding: 9, borderRadius: 8, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center' },
});
