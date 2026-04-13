/**
 * app/(tabs)/index.tsx
 * AIBRAM v17.7 — "Space & Focus" Update
 *
 * NEW:
 * - Space screen: idea cards with 4 states (Raw/Expanded/Linked/Promoted)
 *   Ask Aibram opens chat with thread context banner
 * - Focus screen rebuilt: Deep Focus + Mindfulness mode cards
 *   Intent picker, ambient sounds via expo-av
 * - Vibe check added to Daily Briefing (Recharging/Steady/Locked in)
 *   Energy injected into every Aibram system prompt
 *
 * AUDIO FILES NEEDED in /assets/sounds/:
 *   rain.mp3, lofi.mp3, whitenoise.mp3, forest.mp3
 *
 * Nav: Home · Tasks · Aibram · Focus · Space
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar,
  Animated, Easing, ActivityIndicator, Alert, Modal,
  Keyboard, NativeScrollEvent, NativeSyntheticEvent, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { useFonts, Inter_400Regular, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { auth, db } from '../../firebase/firebaseConfig';
import { signOutUser, deleteAccount } from '../../firebase/authFunctions';

const MISTRAL_KEY  = '5tstU0ZqrhkToB1Wzqh2G4hTWjzMORtS';
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── NOTIFICATION SETUP ───────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// ─── CONTENT FILTER ───────────────────────────────────────────────────────────
const BAD_WORDS = ['fuck','shit','bitch','asshole','cunt','nigger','nigga','faggot','retard','whore','slut','rape','kill yourself','kys'];
const containsBadWord = (text: string) => BAD_WORDS.some(w => text.toLowerCase().includes(w));
const FILTER_RESPONSE = "That's not what I'm here for. What do you actually need?";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#050B14', primary: '#4D96FF', thinking: '#D946EF', accent: '#7F5AF0',
  text: '#E2E8F0', sub: '#94A3B8', success: '#2CB67D', warning: '#FF8906',
  danger: '#EF4565', gold: '#FFD700', low: '#F59E0B',
  holo: 'rgba(77,150,255,0.2)', line: 'rgba(255,255,255,0.05)',
};

// ─── CONTENT ─────────────────────────────────────────────────────────────────
const DAILY_QUOTES = [
  "Small steps every day beat big steps someday.",
  "You don't have to feel ready. You just have to start.",
  "Discipline is choosing what you want most over what you want now.",
  "The grind is the glory.", "Show up. That's already more than most.",
  "Progress, not perfection.", "Every expert was once a beginner. Keep going.",
  "Your future self is watching. Don't let them down.",
  "It's not about motivation. It's about momentum.",
  "Hard days build the person you're becoming.",
  "Stay the course. The results are coming.",
  "Lock in. Everything else can wait.",
];

const FALLBACKS = [
  "That's a solid move. Keep building on it.",
  "You're already doing better than you think.",
  "Just take the next small step.",
  "Don't overthink it — start, then adjust.",
  "Progress is progress, no matter how small.",
];

const LOG_NOTES = [
  "Logged. Every entry is a data point in your story.",
  "Got it. Reflection is how you level up.",
  "Saved. That took honesty — keep going.",
  "The habit of logging compounds. Keep it up.",
];

const QUICK_ACTIONS = [
  { label: "I'm stressed",  icon: "pulse-outline"   },
  { label: "I can't focus", icon: "eye-off-outline"  },
  { label: "Motivate me",   icon: "flash-outline"    },
  { label: "Help me start", icon: "play-outline"     },
  { label: "Plan my week",  icon: "calendar-outline" },
];

const RANKS = [
  { name: "Drifter",   minXp: 0,    tier: 1 },
  { name: "Cadet",     minXp: 150,  tier: 2 },
  { name: "Explorer",  minXp: 400,  tier: 3 },
  { name: "Pioneer",   minXp: 800,  tier: 4 },
  { name: "Commander", minXp: 1500, tier: 5 },
  { name: "Architect", minXp: 3000, tier: 6 },
];

// ─── SOUND FILES ─────────────────────────────────────────────────────────────
const SOUNDS: Record<string, any> = {
  Rain:        require('../../assets/sounds/rain.mp3'),
  'Lo-fi':     require('../../assets/sounds/lofi.mp3'),
  'White noise':require('../../assets/sounds/whitenoise.mp3'),
  Forest:      require('../../assets/sounds/forest.mp3'),
};

// ─── AGE SUGGESTIONS ──────────────────────────────────────────────────────────
const getAgeGroup = (age: number) => {
  if (age <= 17) return 'student';
  if (age <= 22) return 'college';
  if (age <= 29) return 'youngPro';
  return 'adult';
};

const SUGGESTIONS: Record<string, any> = {
  student:  { short:["Finish homework","Study for exams","Sleep earlier","Work out","Read more","Reduce screen time"], mid:["Get better grades","Get into college","Build a skill","Make the team","Save money"], long:["Get into a good school","Figure out what I want","Build something I'm proud of"], struggles:["Focus","Procrastination","Phone addiction","Motivation","Anxiety","Starting tasks"] },
  college:  { short:["Pass my classes","Work out","Sleep better","Network more","Build a portfolio","Read more"], mid:["Land an internship","Graduate","Start something","Build a skill","Save money"], long:["Build a career","Be financially independent","Start a business","Make an impact"], struggles:["Procrastination","Motivation","Focus","Stress","Consistency","Burnout"] },
  youngPro: { short:["Hit my targets","Work out","Side project","Read more","Network","Sleep better"], mid:["Get promoted","Launch a product","Build savings","Build a habit","Learn a skill"], long:["Start a company","Financial freedom","Make an impact","Build something lasting"], struggles:["Consistency","Focus","Burnout","Work-life balance","Motivation","Starting tasks"] },
  adult:    { short:["Finish a project","Work out","Read more","Spend less","Sleep better","Be present"], mid:["Change careers","Get healthy","Build savings","Launch something","Build a habit"], long:["Build lasting wealth","Leave a legacy","Create something","Retire early"], struggles:["Consistency","Work-life balance","Focus","Discipline","Starting tasks","Burnout"] },
};

const INTERESTS = ["Music","Gaming","Fitness","Art","Reading","Tech","Sports","Cooking","Fashion","Film","Photography","Writing","Travel","Coding","Business","Mindfulness"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getRank     = (xp: number) => RANKS.slice().reverse().find(r => xp >= r.minXp) || RANKS[0];
const getNextRank = (xp: number) => RANKS.find(r => r.minXp > xp) || { name: "Max Rank", minXp: 10000 };
const fmtDate     = (d: Date)    => d.toISOString().split('T')[0];
const today       = ()           => fmtDate(new Date());
const yesterday   = ()           => fmtDate(new Date(Date.now() - 86400000));
const dayOffset   = (n: number)  => fmtDate(new Date(Date.now() + n * 86400000));
const dailyQuote  = () => { const s = new Date(new Date().getFullYear(), 0, 0); return DAILY_QUOTES[Math.floor((new Date().getTime() - s.getTime()) / 86400000) % DAILY_QUOTES.length]; };
const rand        = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const suggestedDateToIso = (s: string): string => {
  if (!s) return today();
  const l = s.toLowerCase();
  if (l === 'today')    return today();
  if (l === 'tomorrow') return dayOffset(1);
  const target = DAY_NAMES.findIndex(d => d.toLowerCase() === l);
  if (target === -1) return today();
  const diff = (target - new Date().getDay() + 7) % 7 || 7;
  return dayOffset(diff);
};

// ─── FIRESTORE HELPERS ────────────────────────────────────────────────────────
const uid     = () => auth.currentUser?.uid ?? '';
const dataRef = (key: string) => doc(db, 'users', uid(), 'data', key);
const saveToFirestore   = async (key: string, value: any) => { if (!uid()) return; await setDoc(dataRef(key), { value }, { merge: true }); };
const loadFromFirestore = async (key: string) => { if (!uid()) return null; const snap = await getDoc(dataRef(key)); return snap.exists() ? snap.data().value : null; };

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
const requestNotificationPermission = async () => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

const scheduleTaskNotification = async (task: any) => {
  if (!task.timeLabel || !task.date) return;
  const match = task.timeLabel.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return;
  let hour = parseInt(match[1]);
  const min = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const trigger = new Date(task.date);
  trigger.setHours(hour, min, 0, 0);
  if (trigger <= new Date()) return;
  await Notifications.scheduleNotificationAsync({ content: { title: 'AIBRAM', body: `Time for: ${task.text}` }, trigger });
};

const scheduleStreakReminder = async () => {
  const tonight = new Date();
  tonight.setHours(20, 0, 0, 0);
  if (tonight <= new Date()) tonight.setDate(tonight.getDate() + 1);
  await Notifications.scheduleNotificationAsync({ identifier: 'streak_reminder', content: { title: 'AIBRAM', body: "Don't break your streak — check in before midnight." }, trigger: tonight });
};

// ─── MISTRAL ──────────────────────────────────────────────────────────────────
const ENERGY_CONTEXT: Record<string, string> = {
  Recharging: "The user's energy today is LOW (Recharging). Be warm and supportive — don't push hard tasks. Suggest lighter actions, acknowledge that low energy days are normal. If they ask what to work on, suggest the single smallest thing.",
  Steady:     "The user's energy today is NORMAL (Steady). Regular tone — direct, helpful, balanced.",
  'Locked in':"The user's energy today is HIGH (Locked in). They're ready to push. Be more direct and challenge them to go further than they planned.",
};

const buildProfileContext = (profile: any) => {
  if (!profile) return '';
  const ageLabel = profile.ageGroup === 'student' ? `${profile.age} years old (high school)` : profile.ageGroup === 'college' ? `${profile.age} years old (college)` : profile.ageGroup === 'youngPro' ? `${profile.age} years old (young professional)` : `${profile.age} years old (adult)`;
  return `\nUSER PROFILE:\n- Age: ${ageLabel}\n- Short-term: ${(profile.shortTermGoals||[]).join(', ')||'none'}\n- Mid-term: ${(profile.midTermGoals||[]).join(', ')||'none'}\n- Long-term: ${(profile.longTermGoals||[]).join(', ')||'none'}\n- Interests: ${(profile.interests||[]).join(', ')||'none'}\n- Struggle: ${profile.struggle||'not specified'}`;
};

const buildMessages = (userName: string, rank: string, xp: number, goals: any[], history: any[], userMsg: string, profile: any, energy: string, ideaContext?: string) => {
  const todayTasks = goals.filter((g: any) => g.date === today());
  const taskCtx = todayTasks.length ? todayTasks.map((t: any) => `"${t.text}"${t.timeLabel?` at ${t.timeLabel}`:''} (${t.completed?'done':'pending'})`).join(', ') : 'none';
  const energyNote = energy ? ENERGY_CONTEXT[energy] || '' : '';
  const ideaNote = ideaContext ? `\nIDEA CONTEXT (user is asking about this specific idea): "${ideaContext}"\nRespond directly about this idea first.` : '';

  const systemPrompt = `You are AIBRAM — an AI co-pilot helping ${userName} stay focused and reach their goals.

PERSONALITY:
- Sound like a real person. Warm, honest, direct — not a motivational poster.
- You can help with anything — writing, questions, debates, creative work, off-topic stuff. Do it genuinely.
- After off-topic help, naturally tie back to their world only if it makes sense. Don't force it.
- Never end with a pushy challenge question. Only ask questions when they genuinely move the conversation.
- Vary your style. 2-4 sentences for most messages. Longer only if the topic needs it.
- Light profanity is okay very occasionally. Default to clean language — users can be as young as 13.
- Never say: "absolutely", "great question", "of course!", "certainly", "I'd be happy to", "no fluff", "let's get after it", "crush your goals", "move the needle".

${energyNote}

CONTENT RULES:
- Only refuse if: slurs, explicit sexual content, graphic violence, self-harm.
- If that happens: "${FILTER_RESPONSE}"
- Everything else — help like a real person.

CONTEXT:
- User: ${userName} | Rank: ${rank} (${xp} XP)
- Today's tasks: ${taskCtx}
${buildProfileContext(profile)}${ideaNote}

If user wants to plan their week: return action type "schedule".

RESPONSE FORMAT — always valid JSON:
{
  "reply": "your response",
  "action": { "type": "none"|"add_task"|"focus"|"add_subtasks"|"schedule", "task": "...", "time": "...", "parentTaskId": "...", "subtasks": [] }
}
Only return JSON. No markdown.`;

  const ctx = history.slice(-6).map((m: any) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
  return [{ role: 'system', content: systemPrompt }, ...ctx, { role: 'user', content: userMsg }];
};

const callMistral = async (messages: any[], maxTokens = 400) => {
  try {
    const res = await Promise.race([
      fetch('https://api.mistral.ai/v1/chat/completions', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${MISTRAL_KEY}`}, body:JSON.stringify({model:'mistral-small',messages,temperature:0.72,max_tokens:maxTokens}) }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
    ]);
    const data = await (res as Response).json();
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? '';
    const clean = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    try { const p = JSON.parse(clean); if (p.reply) return { reply: p.reply, action: p.action||{type:'none'} }; } catch {}
    const m = clean.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) return { reply: m[1], action: {type:'none'} };
    if (raw && !raw.startsWith('{') && raw.length > 10) return { reply: raw, action: {type:'none'} };
    return { reply: rand(FALLBACKS), action: {type:'none'} };
  } catch { return { reply: rand(FALLBACKS), action: {type:'none'} }; }
};

const generateGreeting = async (name: string, profile: any): Promise<string> => {
  const ageNote = profile.ageGroup==='student'?'They are in high school.':profile.ageGroup==='college'?'They are in college.':profile.ageGroup==='youngPro'?'They are a young professional.':'They are an established adult.';
  const prompt = `You are AIBRAM. Meeting ${name} for the first time. ${ageNote}\nGoals: ${(profile.shortTermGoals||[]).join(', ')||'none'}. Struggle: ${profile.struggle||'none'}.\nWrite a personal greeting (2-3 sentences). Use their name. Reference a specific goal or struggle. Warm, real, direct. Return only the greeting text.`;
  try {
    const res = await Promise.race([fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${MISTRAL_KEY}`},body:JSON.stringify({model:'mistral-small',messages:[{role:'user',content:prompt}],temperature:0.85,max_tokens:120})}),new Promise<never>((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))]);
    const data = await (res as Response).json();
    return data.choices?.[0]?.message?.content?.trim() || `Good to meet you, ${name}. You've got real goals — let's make them happen.`;
  } catch { return `Good to meet you, ${name}. You've got real goals — let's make them happen.`; }
};

const generateDailyBriefing = async (name: string, profile: any, todayTasks: any[], streak: number, yesterdayCompleted: number): Promise<string> => {
  const dayName = DAY_NAMES[new Date().getDay()];
  const taskList = todayTasks.length > 0 ? todayTasks.map((t: any) => `"${t.text}"`).join(', ') : 'none scheduled';
  const prompt = `You are AIBRAM. Morning briefing for ${name}.\nToday is ${dayName}. Tasks: ${taskList}. Streak: ${streak} days. Yesterday completed: ${yesterdayCompleted} tasks.\nGoals: ${(profile?.shortTermGoals||[]).join(', ')||'none'}. Struggle: ${profile?.struggle||'none'}.\nWrite 3-4 sentences. Personal, direct, specific to their day. No "good morning", no corporate language. Return only the briefing text.`;
  try {
    const res = await Promise.race([fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${MISTRAL_KEY}`},body:JSON.stringify({model:'mistral-small',messages:[{role:'user',content:prompt}],temperature:0.8,max_tokens:150})}),new Promise<never>((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))]);
    const data = await (res as Response).json();
    return data.choices?.[0]?.message?.content?.trim() || `You've got ${todayTasks.length} task${todayTasks.length!==1?'s':''} today. Streak is at ${streak}. Make ${dayName} count.`;
  } catch { return `You've got ${todayTasks.length} task${todayTasks.length!==1?'s':''} today. Streak is at ${streak}. Make ${dayName} count.`; }
};

const generateWeeklyReview = async (name: string, completed: number, total: number, xpEarned: number, streak: number, profile: any): Promise<string> => {
  const prompt = `You are AIBRAM. Weekly review for ${name}.\nThis week: ${completed}/${total} tasks completed. XP: ${xpEarned}. Streak: ${streak}.\nGoals: ${(profile?.shortTermGoals||[]).join(', ')||'none'}.\nWrite 2-3 sentences with one specific observation. Direct, honest, not generic. Return only the observation.`;
  try {
    const res = await Promise.race([fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${MISTRAL_KEY}`},body:JSON.stringify({model:'mistral-small',messages:[{role:'user',content:prompt}],temperature:0.8,max_tokens:120})}),new Promise<never>((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))]);
    const data = await (res as Response).json();
    return data.choices?.[0]?.message?.content?.trim() || `${completed} of ${total} tasks done this week.`;
  } catch { return `${completed} of ${total} tasks done this week.`; }
};

const generateTaskSuggestions = async (name: string, profile: any): Promise<any[]> => {
  const prompt = `Generate 5 specific, actionable first tasks for ${name} to start this week.
Age group: ${profile.ageGroup}. Goals: ${(profile.shortTermGoals||[]).join(', ')||'none'}. Struggle: ${profile.struggle||'none'}.

RULES:
- Every task must be SPECIFIC. Bad: "study more". Good: "read chapter 2 of your textbook and write 5 bullet point notes". Bad: "work on app". Good: "build the profile screen UI in your app".
- Each task must be completable in one sitting.
- Match their age group and goals directly — make it feel personal to ${name}.
- The "why" should be one sentence connecting the task to their specific goal or struggle.

Return ONLY valid JSON, no markdown:
[{"text":"specific task","why":"one sentence connecting to their goal","suggestedDate":"today|tomorrow|monday|tuesday|wednesday|thursday|friday"}]`;
  try {
    const res = await Promise.race([fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${MISTRAL_KEY}`},body:JSON.stringify({model:'mistral-small',messages:[{role:'user',content:prompt}],temperature:0.7,max_tokens:500})}),new Promise<never>((_,r)=>setTimeout(()=>r(new Error('timeout')),10000))]);
    const data = await (res as Response).json();
    const raw = data.choices?.[0]?.message?.content?.trim()??'';
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim());
  } catch { return [{text:"Complete one important task today",why:"Building momentum starts with one win.",suggestedDate:"today"},{text:"Plan your week",why:"Clarity on what's ahead reduces anxiety.",suggestedDate:"today"}]; }
};

const generateSubtasks = async (taskText: string, profile: any): Promise<string[]> => {
  const prompt = `Break down: "${taskText}"\nReturn ONLY JSON array: ["subtask1","subtask2",...]\nNo markdown.`;
  try {
    const res = await Promise.race([fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${MISTRAL_KEY}`},body:JSON.stringify({model:'mistral-small',messages:[{role:'user',content:prompt}],temperature:0.7,max_tokens:200})}),new Promise<never>((_,r)=>setTimeout(()=>r(new Error('timeout')),7000))]);
    const data = await (res as Response).json();
    const raw = data.choices?.[0]?.message?.content?.trim()??'';
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim());
  } catch { return [`Start ${taskText}`,`Continue ${taskText}`,`Complete ${taskText}`]; }
};

// ─── CHIP ─────────────────────────────────────────────────────────────────────
const Chip = ({ label, selected, onPress }: any) => (
  <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onPress(label); }} style={{ paddingVertical:8,paddingHorizontal:14,borderRadius:20,borderWidth:1.5,margin:4, borderColor:selected?C.primary:'rgba(255,255,255,0.15)', backgroundColor:selected?'rgba(77,150,255,0.18)':'rgba(255,255,255,0.04)' }}>
    <Text style={{ color:selected?C.primary:C.sub, fontFamily:'Inter_700Bold', fontSize:13 }}>{label}</Text>
  </TouchableOpacity>
);

// ─── AGE PICKER ───────────────────────────────────────────────────────────────
const ITEM_HEIGHT = 48;
const AGES = Array.from({ length: 68 }, (_, i) => i + 13);

const AgePicker = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [selectedAge, setSelectedAge] = useState(value);
  useEffect(() => { const t = setTimeout(() => { scrollRef.current?.scrollTo({ y:(value-13)*ITEM_HEIGHT, animated:false }); }, 150); return () => clearTimeout(t); }, []);
  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const picked = AGES[Math.max(0,Math.min(AGES.length-1,Math.round(e.nativeEvent.contentOffset.y/ITEM_HEIGHT)))];
    Haptics.selectionAsync(); setSelectedAge(picked); onChange(picked);
  };
  return (
    <View style={{ height:ITEM_HEIGHT*3, overflow:'hidden', position:'relative' }}>
      <View pointerEvents="none" style={{ position:'absolute',top:ITEM_HEIGHT,left:16,right:16,height:ITEM_HEIGHT,backgroundColor:'rgba(77,150,255,0.12)',borderRadius:10,borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(77,150,255,0.3)',zIndex:1 }}/>
      <View pointerEvents="none" style={{ position:'absolute',top:0,left:0,right:0,height:ITEM_HEIGHT,backgroundColor:'rgba(5,11,20,0.82)',zIndex:1 }}/>
      <View pointerEvents="none" style={{ position:'absolute',bottom:0,left:0,right:0,height:ITEM_HEIGHT,backgroundColor:'rgba(5,11,20,0.82)',zIndex:1 }}/>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} snapToInterval={ITEM_HEIGHT} snapToAlignment="center" decelerationRate="fast" onMomentumScrollEnd={handleScrollEnd} onScrollEndDrag={handleScrollEnd} contentContainerStyle={{ paddingVertical:ITEM_HEIGHT }}>
        {AGES.map(age => { const isSel=age===selectedAge; return <View key={age} style={{ height:ITEM_HEIGHT,justifyContent:'center',alignItems:'center' }}><Text style={{ fontSize:isSel?28:18,fontFamily:isSel?'Inter_900Black':'Inter_400Regular',color:isSel?'#FFF':'rgba(255,255,255,0.22)',letterSpacing:isSel?1:0 }}>{age}</Text></View>; })}
      </ScrollView>
    </View>
  );
};

// ─── TYPING TEXT ──────────────────────────────────────────────────────────────
const TypingText = ({ text, onDone }: { text: string; onDone: () => void }) => {
  const [displayed, setDisplayed] = useState('');
  const idx = useRef(0);
  useEffect(() => {
    if (!text) return;
    idx.current = 0; setDisplayed('');
    const iv = setInterval(() => {
      if (idx.current < text.length) { setDisplayed(text.slice(0,idx.current+1)); idx.current++; }
      else { clearInterval(iv); setTimeout(onDone, 2000); }
    }, 28);
    return () => clearInterval(iv);
  }, [text]);
  return <Text style={{ color:C.text,fontSize:18,fontFamily:'Inter_400Regular',lineHeight:30,textAlign:'center' }}>{displayed}<Text style={{ color:C.primary }}>|</Text></Text>;
};

// ─── VISUAL COMPONENTS ────────────────────────────────────────────────────────
const AsteroidField = ({ tasks }: any) => {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(rot,{toValue:1,duration:40000,easing:Easing.linear,useNativeDriver:true})).start(); },[]);
  const spin=rot.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});
  const active=tasks.filter((t: any)=>!t.completed).slice(0,12), tod=today();
  return (
    <Animated.View style={[StyleSheet.absoluteFill,{transform:[{rotate:spin}],zIndex:0}]} pointerEvents="none">
      {active.map((task: any,i: number)=>{ let color=C.primary; if(task.date===tod||task.date<tod)color=C.danger; else if(task.date===fmtDate(new Date(Date.now()+86400000)))color=C.warning; const angle=(i/active.length)*2*Math.PI,r=70+(i%3)*15; return <View key={i} style={{ position:'absolute',top:60+Math.sin(angle)*r,left:100+Math.cos(angle)*r,width:6+(i%3)*3,height:6+(i%3)*3,backgroundColor:color,borderRadius:2,opacity:0.8,transform:[{rotate:`${i*45}deg`}] }}/>; })}
    </Animated.View>
  );
};

const PulsingOrb = ({ size=60, color=C.primary, isThinking=false, colorOverride }: any) => {
  const scale=useRef(new Animated.Value(1)).current,opacity=useRef(new Animated.Value(0.5)).current,cAnim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{ Animated.loop(Animated.parallel([Animated.sequence([Animated.timing(scale,{toValue:1.2,duration:2000,useNativeDriver:false}),Animated.timing(scale,{toValue:1,duration:2000,useNativeDriver:false})]),Animated.sequence([Animated.timing(opacity,{toValue:0.8,duration:2000,useNativeDriver:false}),Animated.timing(opacity,{toValue:0.5,duration:2000,useNativeDriver:false})])])).start(); },[]);
  useEffect(()=>{ Animated.timing(cAnim,{toValue:isThinking?1:0,duration:500,useNativeDriver:false}).start(); },[isThinking]);
  const activeColor=cAnim.interpolate({inputRange:[0,1],outputRange:[colorOverride||color,C.thinking]});
  return (
    <View style={{ width:size,height:size,justifyContent:'center',alignItems:'center' }}>
      <Animated.View style={{ position:'absolute',width:size,height:size,borderRadius:size/2,backgroundColor:activeColor,opacity,transform:[{scale}] }}/>
      <View style={{ width:size*0.4,height:size*0.4,borderRadius:size,backgroundColor:'#FFF',shadowColor:'#FFF',shadowRadius:10,shadowOpacity:0.5 }}/>
    </View>
  );
};

const generateAibramTemplate = async (description: string, profile: any): Promise<any[]> => {
  const prompt = `Generate a detailed task list for this goal: "${description}"
User: age group ${profile?.ageGroup||'unknown'}, goals: ${(profile?.shortTermGoals||[]).join(', ')||'none'}, struggle: ${profile?.struggle||'none'}.

RULES — follow these strictly:
- Every task must be SPECIFIC and actionable. Bad: "study". Good: "read pages 40-60 of chapter 3 and write a summary". Bad: "work on project". Good: "build the login screen component and test it".
- Each task must be completable in one sitting (1-3 hours max).
- If the description mentions a timeframe (e.g. "2 weeks", "10 days"), spread tasks across that FULL timeframe. Never shorten it.
- Match the user's age group — a student's tasks look different from a professional's.
- Spread tasks realistically — do not put everything on day 1.
- Aim for 8-12 tasks for a 1-week plan, 14-20 tasks for a 2-week plan, scaling accordingly.

Return ONLY a valid JSON array, no markdown, no explanation:
[{ "text": "specific task name", "date": "today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday" }]`;
  try {
    const res = await Promise.race([
      fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${MISTRAL_KEY}`},body:JSON.stringify({model:'mistral-small',messages:[{role:'user',content:prompt}],temperature:0.7,max_tokens:800})}),
      new Promise<never>((_,r)=>setTimeout(()=>r(new Error('timeout')),12000)),
    ]);
    const data = await (res as Response).json();
    const raw = data.choices?.[0]?.message?.content?.trim()??'';
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim());
  } catch { return []; }
};
    tasks:(start: Date)=>{ const t: any[]=[]; for(let w=0;w<4;w++){[1,3,5].forEach(d=>{const date=new Date(start);date.setDate(date.getDate()+w*7+d);t.push({text:'Work out',date:fmtDate(date),timeLabel:'7:00 AM'});});} return t; } },
  { id:'study', icon:'📚', name:'Exam Study Plan', description:'Daily study sessions for 2 weeks', days:14,
    tasks:(start: Date)=>Array.from({length:14},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return{text:`Study session ${i+1}`,date:fmtDate(d),timeLabel:'4:00 PM'};}) },
  { id:'sprint', icon:'💻', name:'App Sprint', description:'Daily dev tasks for 1 week', days:7,
    tasks:(start: Date)=>['Set up project structure','Build core feature','Add UI polish','Write tests','Fix bugs','Deploy to staging','Final review'].map((text,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return{text,date:fmtDate(d),timeLabel:null};}) },
  { id:'morning', icon:'🌅', name:'Morning Routine', description:'Daily habits for 1 week', days:7,
    tasks:(start: Date)=>{const t: any[]=[]; for(let i=0;i<7;i++){const d=new Date(start);d.setDate(d.getDate()+i);['Wake up on time','Exercise 20 min','No phone first hour'].forEach((text,j)=>{t.push({text,date:fmtDate(d),timeLabel:j===0?'7:00 AM':j===1?'7:30 AM':null});});} return t;} },
  { id:'reading', icon:'📖', name:'Reading Habit', description:'Read 20 min daily for 2 weeks', days:14,
    tasks:(start: Date)=>Array.from({length:14},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return{text:'Read for 20 minutes',date:fmtDate(d),timeLabel:'9:00 PM'};}) },
  { id:'stress', icon:'🧘', name:'Stress Reset', description:'Light daily tasks for 1 week', days:7,
    tasks:(start: Date)=>{const t: any[]=[]; for(let i=0;i<7;i++){const d=new Date(start);d.setDate(d.getDate()+i);['10 min meditation','Go for a walk','Journal for 5 min'].forEach(text=>{t.push({text,date:fmtDate(d),timeLabel:null});});} return t;} },
];

// ─── TEMPLATES MODAL ──────────────────────────────────────────────────────────
const TemplatesModal = ({ visible, onClose, onAddTasks, profile }: any) => {
  const [activeTab,setActiveTab]=useState<'presets'|'aibram'>('presets');
  const [startDate,setStartDate]=useState(today());
  const [aiPrompt,setAiPrompt]=useState('');
  const [aiTasks,setAiTasks]=useState<any[]>([]);
  const [aiLoading,setAiLoading]=useState(false);
  const [selectedPre,setSelectedPre]=useState<string|null>(null);
  const [previewTasks,setPreviewTasks]=useState<any[]>([]);

  const handlePresetSelect=(t: any)=>{
    setSelectedPre(t.id);
    const start=new Date(startDate);
    setPreviewTasks(t.tasks(start).map((pt: any,i: number)=>({...pt,id:Date.now().toString()+i,completed:false,subtasks:[],selected:true})));
  };

  const handleGenerate=async()=>{
    if(!aiPrompt.trim())return;
    setAiLoading(true);
    const raw=await generateAibramTemplate(aiPrompt,profile);
    setAiTasks(raw.map((t: any,i: number)=>({id:Date.now().toString()+i,text:t.text,date:suggestedDateToIso(t.date),completed:false,subtasks:[],timeLabel:null,selected:true})));
    setAiLoading(false);
  };

  const handleAdd=()=>{
    const tasks=activeTab==='presets'?previewTasks.filter((t: any)=>t.selected):aiTasks.filter((t: any)=>t.selected);
    onAddTasks(tasks);onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={S.overlay}>
        <View style={[S.modalBox,{maxHeight:'85%'}]}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <Text style={S.modalTitle}>Task Templates</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={C.sub}/></TouchableOpacity>
          </View>
          <View style={{flexDirection:'row',backgroundColor:'rgba(255,255,255,0.05)',borderRadius:10,padding:3,marginBottom:16}}>
            {(['presets','aibram'] as const).map(tab=>(
              <TouchableOpacity key={tab} onPress={()=>setActiveTab(tab)} style={{flex:1,paddingVertical:8,alignItems:'center',borderRadius:8,backgroundColor:activeTab===tab?C.primary:'transparent'}}>
                <Text style={{color:activeTab===tab?'#050B14':C.sub,fontFamily:'Inter_700Bold',fontSize:13}}>{tab==='presets'?'Presets':'Ask Aibram'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight:400}}>
            {activeTab==='presets'?(
              <View>
                <Text style={[S.sectionLabel,{marginBottom:8}]}>START DATE</Text>
                <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
                  {[today(),dayOffset(1),dayOffset(2)].map((d,i)=>(
                    <TouchableOpacity key={d} onPress={()=>{setStartDate(d);if(selectedPre){const t=PRESET_TEMPLATES.find(pt=>pt.id===selectedPre);if(t)handlePresetSelect(t);}}} style={{flex:1,paddingVertical:8,alignItems:'center',borderRadius:8,borderWidth:1,borderColor:startDate===d?C.primary:C.line,backgroundColor:startDate===d?'rgba(77,150,255,0.1)':'transparent'}}>
                      <Text style={{color:startDate===d?C.primary:C.sub,fontSize:12}}>{i===0?'Today':i===1?'Tomorrow':d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {PRESET_TEMPLATES.map(t=>(
                  <TouchableOpacity key={t.id} onPress={()=>handlePresetSelect(t)} style={{padding:14,borderRadius:12,borderWidth:1.5,borderColor:selectedPre===t.id?C.primary:C.line,backgroundColor:selectedPre===t.id?'rgba(77,150,255,0.08)':'rgba(255,255,255,0.03)',marginBottom:10}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                      <Text style={{fontSize:22}}>{t.icon}</Text>
                      <View style={{flex:1}}>
                        <Text style={{color:'#FFF',fontFamily:'Inter_700Bold',fontSize:14}}>{t.name}</Text>
                        <Text style={{color:C.sub,fontSize:12,marginTop:2}}>{t.description}</Text>
                      </View>
                      {selectedPre===t.id&&<Ionicons name="checkmark-circle" size={20} color={C.primary}/>}
                    </View>
                  </TouchableOpacity>
                ))}
                {previewTasks.length>0&&(
                  <View style={{marginTop:8}}>
                    <Text style={[S.sectionLabel,{marginBottom:8}]}>PREVIEW — tap to toggle</Text>
                    {previewTasks.slice(0,6).map((t: any,i: number)=>(
                      <TouchableOpacity key={i} onPress={()=>setPreviewTasks(p=>p.map((pt,pi)=>pi===i?{...pt,selected:!pt.selected}:pt))} style={{flexDirection:'row',alignItems:'center',paddingVertical:6,gap:8}}>
                        <Ionicons name={t.selected?'checkbox':'square-outline'} size={18} color={t.selected?C.primary:C.sub}/>
                        <Text style={{color:t.selected?C.text:C.sub,fontSize:13,flex:1}}>{t.text}</Text>
                        <Text style={{color:C.sub,fontSize:11}}>{t.date}</Text>
                      </TouchableOpacity>
                    ))}
                    {previewTasks.length>6&&<Text style={{color:C.sub,fontSize:12,marginTop:4}}>+{previewTasks.length-6} more tasks</Text>}
                  </View>
                )}
              </View>
            ):(
              <View>
                <Text style={{color:C.sub,fontSize:13,marginBottom:12,lineHeight:20}}>Describe what you want to achieve and Aibram will build a task list for you.</Text>
                <View style={S.customRow}>
                  <TextInput style={[S.customInput,{paddingVertical:12}]} value={aiPrompt} onChangeText={setAiPrompt} placeholder="e.g. I want to start running 3x a week..." placeholderTextColor={C.sub} multiline/>
                </View>
                <TouchableOpacity style={[S.primaryBtn,{marginTop:12,opacity:aiLoading||!aiPrompt.trim()?0.6:1}]} onPress={handleGenerate} disabled={aiLoading||!aiPrompt.trim()}>
                  {aiLoading?<ActivityIndicator color={C.bg}/>:<Text style={S.btnTxt}>Generate tasks →</Text>}
                </TouchableOpacity>
                {aiTasks.length>0&&(
                  <View style={{marginTop:8}}>
                    <Text style={[S.sectionLabel,{marginBottom:8}]}>GENERATED — tap to toggle</Text>
                    {aiTasks.map((t: any,i: number)=>(
                      <TouchableOpacity key={i} onPress={()=>setAiTasks(p=>p.map((pt,pi)=>pi===i?{...pt,selected:!pt.selected}:pt))} style={{flexDirection:'row',alignItems:'center',paddingVertical:8,gap:8}}>
                        <Ionicons name={t.selected?'checkbox':'square-outline'} size={18} color={t.selected?C.primary:C.sub}/>
                        <Text style={{color:t.selected?C.text:C.sub,fontSize:13,flex:1}}>{t.text}</Text>
                        <Text style={{color:C.sub,fontSize:11}}>{t.date}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          {((activeTab==='presets'&&previewTasks.some((t: any)=>t.selected))||(activeTab==='aibram'&&aiTasks.some((t: any)=>t.selected)))&&(
            <TouchableOpacity style={[S.primaryBtn,{marginTop:16,marginBottom:0}]} onPress={handleAdd}>
              <Text style={S.btnTxt}>Add {activeTab==='presets'?previewTasks.filter((t: any)=>t.selected).length:aiTasks.filter((t: any)=>t.selected).length} tasks →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── CALENDAR VIEWS ───────────────────────────────────────────────────────────
const MonthView = ({ selectedDate, setSelectedDate, goals }: any) => {
  const [month,setMonth]=useState(new Date());
  const dim=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const fd=new Date(month.getFullYear(),month.getMonth(),1).getDay();
  const days=[...Array(fd).fill(null),...Array(dim).fill(0).map((_: any,i: number)=>i+1)];
  const bump=(dir: number)=>{const n=new Date(month);n.setMonth(n.getMonth()+dir);setMonth(n);};
  return (
    <View style={S.calBox}>
      <View style={S.calHead}>
        <TouchableOpacity onPress={()=>bump(-1)}><Ionicons name="chevron-back" size={24} color={C.primary}/></TouchableOpacity>
        <Text style={S.calTitle}>{month.toLocaleString('default',{month:'long',year:'numeric'}).toUpperCase()}</Text>
        <TouchableOpacity onPress={()=>bump(1)}><Ionicons name="chevron-forward" size={24} color={C.primary}/></TouchableOpacity>
      </View>
      <View style={S.calGrid}>
        {['S','M','T','W','T','F','S'].map((d,i)=><Text key={i} style={S.calLabel}>{d}</Text>)}
        {days.map((day: any,i: number)=>{
          if(!day)return<View key={i} style={S.calCell}/>;
          const ds=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const sel=ds===selectedDate,tod=ds===today();
          const dayGoals=goals.filter((g: any)=>g.date===ds);
          const total=dayGoals.length,done=dayGoals.filter((g: any)=>g.completed).length;
          const allDone=total>0&&done===total,hasOverdue=ds<today()&&total>done&&total>0;
          return (
            <TouchableOpacity key={i} style={[S.calCell,sel&&S.calSel,tod&&!sel&&S.calTod,allDone&&!sel&&{backgroundColor:'rgba(44,182,125,0.15)'},hasOverdue&&!sel&&{backgroundColor:'rgba(239,69,101,0.1)'}]} onPress={()=>{Haptics.selectionAsync();setSelectedDate(ds);}}>
              <Text style={[S.calNum,sel&&{color:'#000',fontWeight:'bold'},tod&&!sel&&{color:C.warning}]}>{day}</Text>
              {total>0&&<Text style={{fontSize:8,color:sel?'#000':allDone?C.success:C.primary,marginTop:1}}>{done}/{total}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const WeekView = ({ goals, onToggleTask, onDeleteTask, onAddTask }: any) => {
  const [weekOffset,setWeekOffset]=useState(0);
  const getWeekDates=(offset: number)=>{const now=new Date();const start=new Date(now);start.setDate(now.getDate()-now.getDay()+offset*7);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return fmtDate(d);});};
  const weekDates=getWeekDates(weekOffset),tod=today();
  const colWidth=(SCREEN_WIDTH-40-48)/3.2;
  return (
    <View style={{marginHorizontal:20,marginBottom:20}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <TouchableOpacity onPress={()=>setWeekOffset(w=>w-1)} style={{padding:8}}><Ionicons name="chevron-back" size={20} color={C.primary}/></TouchableOpacity>
        <TouchableOpacity onPress={()=>setWeekOffset(0)} style={{paddingHorizontal:12,paddingVertical:6,borderRadius:8,backgroundColor:'rgba(77,150,255,0.1)',borderWidth:1,borderColor:'rgba(77,150,255,0.2)'}}>
          <Text style={{color:C.primary,fontSize:12,fontFamily:'Inter_700Bold'}}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setWeekOffset(w=>w+1)} style={{padding:8}}><Ionicons name="chevron-forward" size={20} color={C.primary}/></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{flexDirection:'row',gap:8}}>
          {weekDates.map((date)=>{
            const dayGoals=goals.filter((g: any)=>g.date===date);
            const isToday=date===tod,dayNum=new Date(date).getDate(),dayLabel=DAY_SHORT[new Date(date).getDay()];
            return (
              <View key={date} style={{width:colWidth}}>
                <View style={{alignItems:'center',paddingVertical:8,marginBottom:8,borderRadius:10,backgroundColor:isToday?C.primary:'rgba(255,255,255,0.04)',borderWidth:1,borderColor:isToday?C.primary:C.line}}>
                  <Text style={{color:isToday?'#000':C.sub,fontSize:10,fontFamily:'Inter_700Bold'}}>{dayLabel}</Text>
                  <Text style={{color:isToday?'#000':'#FFF',fontSize:18,fontFamily:'Inter_900Black'}}>{dayNum}</Text>
                </View>
                {dayGoals.map((g: any)=>{
                  const isOverdue=date<tod&&!g.completed;
                  const borderCol=isOverdue?C.danger:date===tod?C.warning:C.primary;
                  return (
                    <TouchableOpacity key={g.id} onPress={()=>onToggleTask(g.id)} onLongPress={()=>onDeleteTask(g.id)} style={{backgroundColor:g.completed?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.06)',borderRadius:8,padding:8,marginBottom:6,borderLeftWidth:2,borderLeftColor:g.completed?'rgba(255,255,255,0.1)':borderCol,opacity:g.completed?0.5:1}}>
                      <Text style={{color:g.completed?C.sub:'#FFF',fontSize:12,fontFamily:'Inter_700Bold',textDecorationLine:g.completed?'line-through':'none'}} numberOfLines={2}>{g.text}</Text>
                      {g.timeLabel&&<Text style={{color:borderCol,fontSize:10,marginTop:3}}>🕐 {g.timeLabel}</Text>}
                      {g.subtasks?.length>0&&<Text style={{color:C.sub,fontSize:10,marginTop:2}}>{g.subtasks.filter((s: any)=>s.completed).length}/{g.subtasks.length}</Text>}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity onPress={()=>onAddTask(date)} style={{alignItems:'center',paddingVertical:6,borderRadius:8,borderWidth:1,borderColor:'rgba(255,255,255,0.08)',borderStyle:'dashed'}}>
                  <Ionicons name="add" size={16} color={C.sub}/>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const DayView = ({ selectedDate, goals, onToggleTask, onDeleteTask }: any) => {
  const HOURS=Array.from({length:18},(_,i)=>i+6);
  const tod=today();
  const dayGoals=goals.filter((g: any)=>g.date===selectedDate);
  const timed=dayGoals.filter((g: any)=>g.timeLabel);
  const untimed=dayGoals.filter((g: any)=>!g.timeLabel);
  const parseHour=(label: string)=>{
    const match=label.match(/^(\d+):(\d+)\s*(AM|PM)$/i);if(!match)return null;
    let h=parseInt(match[1]);const ampm=match[3].toUpperCase();
    if(ampm==='PM'&&h!==12)h+=12;if(ampm==='AM'&&h===12)h=0;return h;
  };
  return (
    <View style={{marginHorizontal:20,marginBottom:20}}>
      {untimed.length>0&&(
        <View style={{marginBottom:16}}>
          <Text style={[S.sectionLabel,{marginBottom:8}]}>UNSCHEDULED</Text>
          {untimed.map((g: any)=>(
            <TouchableOpacity key={g.id} onPress={()=>onToggleTask(g.id)} onLongPress={()=>onDeleteTask(g.id)} style={{flexDirection:'row',alignItems:'center',padding:12,borderRadius:10,backgroundColor:'rgba(255,255,255,0.05)',borderWidth:1,borderColor:C.line,marginBottom:6,opacity:g.completed?0.5:1}}>
              <Ionicons name={g.completed?'checkbox':'square-outline'} size={20} color={g.completed?C.success:C.sub}/>
              <Text style={{color:g.completed?C.sub:'#FFF',marginLeft:10,flex:1,textDecorationLine:g.completed?'line-through':'none'}}>{g.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={[S.sectionLabel,{marginBottom:8}]}>TIMELINE</Text>
      {HOURS.map(hour=>{
        const label=`${hour>12?hour-12:hour}:00 ${hour>=12?'PM':'AM'}`;
        const hourTasks=timed.filter((g: any)=>parseHour(g.timeLabel)===hour);
        const isCurrentHour=new Date().getHours()===hour&&selectedDate===tod;
        return (
          <View key={hour} style={{flexDirection:'row',minHeight:44,marginBottom:2}}>
            <Text style={{color:isCurrentHour?C.primary:C.sub,fontSize:11,width:52,paddingTop:4,fontFamily:isCurrentHour?'Inter_700Bold':'Inter_400Regular'}}>{label}</Text>
            <View style={{flex:1,borderLeftWidth:1,borderLeftColor:isCurrentHour?C.primary:'rgba(255,255,255,0.06)',paddingLeft:10}}>
              {isCurrentHour&&<View style={{position:'absolute',left:-4,top:8,width:8,height:8,borderRadius:4,backgroundColor:C.primary}}/>}
              {hourTasks.map((g: any)=>(
                <TouchableOpacity key={g.id} onPress={()=>onToggleTask(g.id)} onLongPress={()=>onDeleteTask(g.id)} style={{backgroundColor:g.completed?'rgba(255,255,255,0.04)':'rgba(77,150,255,0.1)',borderRadius:8,padding:10,marginBottom:4,borderLeftWidth:3,borderLeftColor:g.completed?C.sub:C.primary,opacity:g.completed?0.6:1}}>
                  <Text style={{color:g.completed?C.sub:'#FFF',fontFamily:'Inter_700Bold',fontSize:13,textDecorationLine:g.completed?'line-through':'none'}}>{g.text}</Text>
                  <Text style={{color:C.primary,fontSize:11,marginTop:2}}>🕐 {g.timeLabel}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const SciFiCalendar = ({ selectedDate, setSelectedDate, taskMap, goals }: any) => {
  const [month,setMonth]=useState(new Date());
  const dim=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const fd=new Date(month.getFullYear(),month.getMonth(),1).getDay();
  const days=[...Array(fd).fill(null),...Array(dim).fill(0).map((_: any,i: number)=>i+1)];
  const bump=(dir: number)=>{ const n=new Date(month); n.setMonth(n.getMonth()+dir); setMonth(n); };
  return (
    <View style={S.calBox}>
      <View style={S.calHead}>
        <TouchableOpacity onPress={()=>bump(-1)}><Ionicons name="chevron-back" size={24} color={C.primary}/></TouchableOpacity>
        <Text style={S.calTitle}>{month.toLocaleString('default',{month:'long',year:'numeric'}).toUpperCase()}</Text>
        <TouchableOpacity onPress={()=>bump(1)}><Ionicons name="chevron-forward" size={24} color={C.primary}/></TouchableOpacity>
      </View>
      <View style={S.calGrid}>
        {['S','M','T','W','T','F','S'].map((d,i)=><Text key={i} style={S.calLabel}>{d}</Text>)}
        {days.map((day: any,i: number)=>{
          if(!day)return<View key={i} style={S.calCell}/>;
          const ds=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const sel=ds===selectedDate,tod=ds===today();
          const dayGoals=goals.filter((g: any)=>g.date===ds);
          const total=dayGoals.length,done=dayGoals.filter((g: any)=>g.completed).length;
          const allDone=total>0&&done===total,hasOverdue=ds<today()&&total>done&&total>0;
          return (
            <TouchableOpacity key={i} style={[S.calCell,sel&&S.calSel,tod&&!sel&&S.calTod,allDone&&!sel&&{backgroundColor:'rgba(44,182,125,0.15)'},hasOverdue&&!sel&&{backgroundColor:'rgba(239,69,101,0.1)'}]} onPress={()=>{Haptics.selectionAsync();setSelectedDate(ds);}}>
              <Text style={[S.calNum,sel&&{color:'#000',fontWeight:'bold'},tod&&!sel&&{color:C.warning}]}>{day}</Text>
              {total>0&&<Text style={{fontSize:8,color:sel?'#000':allDone?C.success:C.primary,marginTop:1}}>{done}/{total}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── SHIPS ───────────────────────────────────────────────────────────────────
const renderShip = (tier: number) => {
  const configs: any={1:{bw:18,bh:44,ww:28,wh:8,wAngle:32,wBottom:6,border:null,engines:null,jewel:false},2:{bw:20,bh:50,ww:34,wh:9,wAngle:30,wBottom:7,border:C.primary,engines:{color:C.primary,count:1},jewel:false},3:{bw:22,bh:54,ww:40,wh:9,wAngle:28,wBottom:8,border:C.primary,engines:{color:C.warning,count:2},jewel:false},4:{bw:22,bh:56,ww:46,wh:10,wAngle:26,wBottom:9,border:C.gold,engines:{color:C.warning,count:2},jewel:false},5:{bw:26,bh:58,ww:52,wh:10,wAngle:25,wBottom:10,border:C.primary,engines:{color:C.primary,count:2},jewel:false},6:{bw:26,bh:62,ww:58,wh:11,wAngle:24,wBottom:11,border:C.gold,engines:{color:C.gold,count:2},jewel:true}};
  const cfg=configs[tier]||configs[1],noseColor=tier>=4?C.gold:C.primary,noseSize=8+tier;
  return (
    <View style={{alignItems:'center'}}>
      <View style={{width:0,height:0,borderLeftWidth:noseSize,borderRightWidth:noseSize,borderBottomWidth:noseSize*1.7,borderLeftColor:'transparent',borderRightColor:'transparent',borderBottomColor:noseColor,marginBottom:-1}}/>
      <View style={{position:'relative',alignItems:'center'}}>
        <View style={{width:cfg.bw,height:cfg.bh,backgroundColor:C.text,borderRadius:5,borderWidth:cfg.border?1.5:0,borderColor:cfg.border||'transparent',zIndex:2}}/>
        <View style={{position:'absolute',bottom:cfg.wBottom,left:-(cfg.ww-cfg.bw/2+2),width:cfg.ww,height:cfg.wh,backgroundColor:C.sub,borderRadius:3,transform:[{rotate:`-${cfg.wAngle}deg`}],zIndex:1}}/>
        <View style={{position:'absolute',bottom:cfg.wBottom,right:-(cfg.ww-cfg.bw/2+2),width:cfg.ww,height:cfg.wh,backgroundColor:C.sub,borderRadius:3,transform:[{rotate:`${cfg.wAngle}deg`}],zIndex:1}}/>
        {tier>=5&&(<><View style={{position:'absolute',bottom:cfg.wBottom+10,left:-(cfg.ww-cfg.bw/2+14),width:cfg.ww*0.55,height:cfg.wh-2,backgroundColor:tier===6?C.gold:C.primary,opacity:0.5,borderRadius:3,transform:[{rotate:`-${cfg.wAngle-4}deg`}],zIndex:1}}/><View style={{position:'absolute',bottom:cfg.wBottom+10,right:-(cfg.ww-cfg.bw/2+14),width:cfg.ww*0.55,height:cfg.wh-2,backgroundColor:tier===6?C.gold:C.primary,opacity:0.5,borderRadius:3,transform:[{rotate:`${cfg.wAngle-4}deg`}],zIndex:1}}/></>)}
        {cfg.jewel&&<View style={{position:'absolute',top:14,width:7,height:7,borderRadius:4,backgroundColor:C.gold,zIndex:3}}/>}
      </View>
      {cfg.engines&&<View style={{flexDirection:'row',gap:cfg.engines.count>1?6:0,marginTop:1}}>{Array(cfg.engines.count).fill(0).map((_: any,i: number)=><View key={i} style={{width:6,height:10+tier,borderRadius:3,backgroundColor:cfg.engines.color}}/>)}</View>}
    </View>
  );
};

const HologramShip = ({ tier }: any) => {
  const fly=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.loop(Animated.sequence([Animated.timing(fly,{toValue:-10,duration:2000,useNativeDriver:true}),Animated.timing(fly,{toValue:0,duration:2000,useNativeDriver:true})])).start();},[]);
  return(<View style={S.hangarShipWrap}><Animated.View style={{transform:[{translateY:fly}],alignItems:'center'}}>{renderShip(tier)}</Animated.View><View style={S.hangarDish}/></View>);
};

// ─── MODALS ───────────────────────────────────────────────────────────────────
const TimePicker = ({ visible, onConfirm, onCancel, initial }: any) => {
  const [hour,setHour]=useState(initial?.hour??8),[minute,setMinute]=useState(initial?.minute??0),[period,setPeriod]=useState(initial?.period??'AM');
  const MINS=[0,15,30,45];
  const bump=(dir: number)=>setHour((h: number)=>{let n=h+dir;if(n>12)n=1;if(n<1)n=12;return n;});
  const label=`${hour}:${String(minute).padStart(2,'0')} ${period}`;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={S.overlay}>
        <View style={[S.modalBox,{paddingBottom:28}]}>
          <Text style={[S.modalTitle,{marginBottom:20}]}>Set a time</Text>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',marginBottom:18}}>
            <TouchableOpacity onPress={()=>bump(-1)} style={{padding:10}}><Ionicons name="chevron-back" size={22} color={C.primary}/></TouchableOpacity>
            <Text style={{color:'#FFF',fontSize:52,fontFamily:'Inter_900Black',marginHorizontal:20,minWidth:80,textAlign:'center'}}>{String(hour).padStart(2,'0')}</Text>
            <TouchableOpacity onPress={()=>bump(1)} style={{padding:10}}><Ionicons name="chevron-forward" size={22} color={C.primary}/></TouchableOpacity>
          </View>
          <Text style={{color:C.sub,fontSize:11,textAlign:'center',marginBottom:10}}>MINUTES</Text>
          <View style={{flexDirection:'row',justifyContent:'center',gap:10,marginBottom:20}}>
            {MINS.map((m: number)=><TouchableOpacity key={m} onPress={()=>{Haptics.selectionAsync();setMinute(m);}} style={{paddingVertical:10,paddingHorizontal:14,borderRadius:10,borderWidth:2,borderColor:minute===m?C.primary:C.line,backgroundColor:minute===m?'rgba(77,150,255,0.15)':'transparent'}}><Text style={{color:minute===m?C.primary:C.sub,fontFamily:'Inter_700Bold',fontSize:16}}>{String(m).padStart(2,'0')}</Text></TouchableOpacity>)}
          </View>
          <View style={{flexDirection:'row',justifyContent:'center',gap:12,marginBottom:28}}>
            {['AM','PM'].map((p: string)=><TouchableOpacity key={p} onPress={()=>{Haptics.selectionAsync();setPeriod(p);}} style={{paddingVertical:10,paddingHorizontal:28,borderRadius:10,borderWidth:2,borderColor:period===p?C.primary:C.line,backgroundColor:period===p?'rgba(77,150,255,0.15)':'transparent'}}><Text style={{color:period===p?C.primary:C.sub,fontFamily:'Inter_700Bold',fontSize:16}}>{p}</Text></TouchableOpacity>)}
          </View>
          <TouchableOpacity style={S.primaryBtn} onPress={()=>onConfirm({hour,minute,period,label})}><Text style={S.btnTxt}>Set {label}</Text></TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={{marginTop:14,alignItems:'center'}}><Text style={{color:C.sub}}>No time — skip</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const TaskEditModal = ({ visible, task, onSave, onCancel }: any) => {
  const [text,setText]=useState(''),[time,setTime]=useState<any>(null),[showTP,setShowTP]=useState(false);
  useEffect(()=>{if(task){setText(task.text);setTime(task.timeLabel?{label:task.timeLabel}:null);}},[task]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={S.overlay}>
        <View style={S.modalBox}>
          <Text style={[S.modalTitle,{marginBottom:16}]}>Edit Task</Text>
          <TextInput style={[S.goalInput,{marginBottom:16,padding:12}]} value={text} onChangeText={setText} placeholder="Task name..." placeholderTextColor={C.sub} autoFocus multiline/>
          <TouchableOpacity onPress={()=>setShowTP(true)} style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:24,padding:12,backgroundColor:'rgba(255,255,255,0.05)',borderRadius:10}}>
            <Ionicons name="time-outline" size={18} color={time?C.primary:C.sub}/>
            <Text style={{color:time?C.primary:C.sub,flex:1}}>{time?time.label:'Add / change time'}</Text>
            {time&&<TouchableOpacity onPress={()=>setTime(null)}><Ionicons name="close-circle" size={16} color={C.sub}/></TouchableOpacity>}
          </TouchableOpacity>
          <TouchableOpacity style={S.primaryBtn} onPress={()=>{if(text.trim())onSave({...task,text:text.trim(),timeLabel:time?.label??null});}}><Text style={S.btnTxt}>Save Changes</Text></TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={{marginTop:14,alignItems:'center'}}><Text style={{color:C.sub}}>Cancel</Text></TouchableOpacity>
        </View>
      </View>
      <TimePicker visible={showTP} initial={null} onConfirm={(t: any)=>{setTime(t);setShowTP(false);}} onCancel={()=>setShowTP(false)}/>
    </Modal>
  );
};

// ─── DAILY BRIEFING SCREEN (with vibe check) ─────────────────────────────────
const DailyBriefingScreen = ({ name, profile, todayTasks, streak, yesterdayCompleted, onDone, onGoToTasks }: any) => {
  const [briefing,setBriefing]=useState(''),[loading,setLoading]=useState(true),[energy,setEnergy]=useState<string|null>(null),[showVibe,setShowVibe]=useState(false);
  useEffect(()=>{ generateDailyBriefing(name,profile,todayTasks,streak,yesterdayCompleted).then(t=>{setBriefing(t);setLoading(false);}); },[]);
  const ENERGY_OPTIONS = [
    {key:'Recharging', icon:'battery-half-outline', desc:'Low energy — keep it light today'},
    {key:'Steady',     icon:'flash-outline',         desc:'Normal day — let\'s get things done'},
    {key:'Locked in',  icon:'flame-outline',         desc:'High energy — push harder today'},
  ];
  const handleDone = () => {
    if (!showVibe) { setShowVibe(true); return; }
    onDone(energy || 'Steady');
  };
  return (
    <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={[S.screen,{justifyContent:'center',alignItems:'center',padding:32}]}>
      <StatusBar barStyle="light-content"/>
      <PulsingOrb size={70} color={C.primary} isThinking={loading}/>
      <Text style={{color:loading?C.thinking:C.primary,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:2,marginTop:14,marginBottom:8}}>{loading?'AIBRAM IS THINKING...':'AIBRAM'}</Text>
      <Text style={{color:C.sub,fontSize:12,marginBottom:28}}>{new Date().toLocaleDateString('default',{weekday:'long',month:'long',day:'numeric'})}</Text>
      {loading?(
        <Text style={{color:C.sub,fontSize:14}}>Preparing your briefing...</Text>
      ):showVibe?(
        <View style={{width:'100%'}}>
          <Text style={{color:'#FFF',fontFamily:'Inter_900Black',fontSize:22,textAlign:'center',marginBottom:6}}>How's your energy?</Text>
          <Text style={{color:C.sub,fontSize:14,textAlign:'center',marginBottom:24}}>Aibram adapts to how you're showing up today.</Text>
          {ENERGY_OPTIONS.map(opt=>(
            <TouchableOpacity key={opt.key} onPress={()=>{Haptics.selectionAsync();setEnergy(opt.key);}} style={{flexDirection:'row',alignItems:'center',gap:14,padding:14,borderRadius:14,borderWidth:1.5,marginBottom:10,borderColor:energy===opt.key?C.primary:'rgba(255,255,255,0.1)',backgroundColor:energy===opt.key?'rgba(77,150,255,0.1)':'rgba(255,255,255,0.03)'}}>
              <Ionicons name={opt.icon as any} size={22} color={energy===opt.key?C.primary:C.sub}/>
              <View style={{flex:1}}>
                <Text style={{color:energy===opt.key?C.primary:'#FFF',fontFamily:'Inter_700Bold',fontSize:15}}>{opt.key}</Text>
                <Text style={{color:C.sub,fontSize:12,marginTop:2}}>{opt.desc}</Text>
              </View>
              {energy===opt.key&&<Ionicons name="checkmark-circle" size={20} color={C.primary}/>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[S.primaryBtn,{marginTop:12,opacity:energy?1:0.5}]} onPress={()=>{if(energy)onDone(energy);}} disabled={!energy}>
            <Text style={S.btnTxt}>Let's go →</Text>
          </TouchableOpacity>
        </View>
      ):(
        <View style={{alignItems:'center',width:'100%'}}>
          <TypingText text={briefing} onDone={()=>{}}/>
          <View style={{flexDirection:'row',gap:12,marginTop:28,marginBottom:32,width:'100%'}}>
            {[{label:'Streak',value:streak,color:C.warning},{label:'Today',value:todayTasks.length,color:C.primary},{label:'Yesterday',value:yesterdayCompleted,color:C.success}].map(item=>(
              <View key={item.label} style={{flex:1,alignItems:'center',backgroundColor:'rgba(255,255,255,0.05)',borderRadius:10,padding:12}}>
                <Text style={{color:item.color,fontFamily:'Inter_900Black',fontSize:20}}>{item.value}</Text>
                <Text style={{color:C.sub,fontSize:11,marginTop:2}}>{item.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[S.primaryBtn,{width:'100%',marginBottom:10}]} onPress={handleDone}>
            <Text style={S.btnTxt}>Set my energy →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>onGoToTasks('Steady')} style={{paddingVertical:10}}>
            <Text style={{color:C.sub,fontSize:13}}>Add a task first</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
};

// ─── ONBOARDING SCREENS ───────────────────────────────────────────────────────
const OnboardScreen0 = ({ onNext }: any) => (
  <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={[S.screen,{justifyContent:'center',alignItems:'center',padding:30}]}>
    <StatusBar barStyle="light-content"/>
    <PulsingOrb size={100} color={C.primary}/>
    <Text style={{fontSize:11,fontFamily:'Inter_700Bold',color:C.primary,letterSpacing:4,marginTop:28,marginBottom:8}}>AIBRAM</Text>
    <Text style={{fontSize:28,fontFamily:'Inter_900Black',color:'#FFF',textAlign:'center',lineHeight:36,marginBottom:20}}>Most productivity apps tell you what to do.</Text>
    <Text style={{fontSize:17,fontFamily:'Inter_400Regular',color:C.sub,textAlign:'center',lineHeight:28}}>Aibram figures it out{'\n'}with you.</Text>
    <TouchableOpacity style={[S.primaryBtn,{marginTop:56,width:'100%'}]} onPress={onNext}><Text style={S.btnTxt}>Let's go →</Text></TouchableOpacity>
  </LinearGradient>
);

const OnboardScreen1 = ({ onNext }: any) => (
  <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={[S.screen,{justifyContent:'center',padding:30}]}>
    <StatusBar barStyle="light-content"/>
    <Text style={{fontSize:24,fontFamily:'Inter_900Black',color:'#FFF',lineHeight:32,marginBottom:12}}>Motivation fades.{'\n'}Discipline is built.</Text>
    <Text style={{color:C.sub,fontSize:15,lineHeight:24,marginBottom:40}}>Aibram is the co-pilot that keeps you moving when you'd rather stop — tracking what matters, reminding you why you started.</Text>
    {[{icon:'chatbubbles-outline',title:'A voice when you need one',body:"Talk through stress and blocks — Aibram pushes back when you need it."},{icon:'infinite-outline',title:'Focus on demand',body:"Guided sessions that get you in the zone, not just a timer."},{icon:'trending-up-outline',title:'Progress that compounds',body:"XP, streaks, and ranks that make showing up feel like it matters."}].map((item,i)=>(
      <View key={i} style={{flexDirection:'row',marginBottom:28,alignItems:'flex-start'}}>
        <View style={{width:40,height:40,borderRadius:12,backgroundColor:'rgba(77,150,255,0.12)',justifyContent:'center',alignItems:'center',marginRight:16,marginTop:2}}><Ionicons name={item.icon as any} size={20} color={C.primary}/></View>
        <View style={{flex:1}}><Text style={{color:'#FFF',fontFamily:'Inter_700Bold',fontSize:15,marginBottom:3}}>{item.title}</Text><Text style={{color:C.sub,fontSize:13,lineHeight:20}}>{item.body}</Text></View>
      </View>
    ))}
    <TouchableOpacity style={[S.primaryBtn,{marginTop:8}]} onPress={onNext}><Text style={S.btnTxt}>Next →</Text></TouchableOpacity>
  </LinearGradient>
);

const OnboardScreen2 = ({ name, setName, onNext }: any) => (
  <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={[S.screen,{justifyContent:'center',padding:30}]}>
    <StatusBar barStyle="light-content"/>
    <Text style={{fontSize:32,fontFamily:'Inter_900Black',color:'#FFF',marginBottom:8}}>What should{'\n'}I call you?</Text>
    <Text style={{color:C.sub,fontSize:15,marginBottom:40}}>Your name stays on the ship.</Text>
    <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.06)',borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',paddingHorizontal:16,marginBottom:40}}>
      <Ionicons name="person-outline" size={20} color={C.sub} style={{marginRight:12}}/>
      <TextInput style={{flex:1,color:'#FFF',fontSize:20,fontFamily:'Inter_700Bold',paddingVertical:16}} placeholder="Your name" placeholderTextColor={C.sub} value={name} onChangeText={setName} autoCapitalize="words" autoFocus returnKeyType="done" onSubmitEditing={()=>{if(name.trim())onNext();}}/>
    </View>
    <TouchableOpacity style={[S.primaryBtn,{opacity:name.trim()?1:0.4}]} onPress={()=>{if(name.trim())onNext();}} disabled={!name.trim()}><Text style={S.btnTxt}>Next →</Text></TouchableOpacity>
  </LinearGradient>
);

const OnboardScreen3 = ({ name, onComplete }: any) => {
  const [age,setAge]=useState(17),[shortGoals,setShortGoals]=useState<string[]>([]),[midGoals,setMidGoals]=useState<string[]>([]),[longGoals,setLongGoals]=useState<string[]>([]),[interests,setInterests]=useState<string[]>([]),[struggle,setStruggle]=useState(''),[customShort,setCustomShort]=useState(''),[customMid,setCustomMid]=useState(''),[customLong,setCustomLong]=useState(''),[saving,setSaving]=useState(false);
  const ageGroup=getAgeGroup(age),sugg=SUGGESTIONS[ageGroup];
  const toggleMulti=(arr: string[],setArr: any,val: string)=>setArr((p: string[])=>p.includes(val)?p.filter(x=>x!==val):[...p,val]);
  const addCustom=(arr: string[],setArr: any,val: string,setVal: any)=>{if(!val.trim())return;if(!arr.includes(val.trim()))setArr((p: string[])=>[...p,val.trim()]);setVal('');Keyboard.dismiss();};
  const handleComplete=()=>{if(!struggle){Alert.alert('One more thing','Select your biggest struggle so Aibram can help.');return;}setSaving(true);onComplete({age,ageGroup,shortTermGoals:shortGoals,midTermGoals:midGoals,longTermGoals:longGoals,interests,struggle});};
  return (
    <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={S.screen}>
      <StatusBar barStyle="light-content"/>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{padding:24,paddingTop:60,paddingBottom:120}} keyboardShouldPersistTaps="handled">
          <Text style={{fontSize:26,fontFamily:'Inter_900Black',color:'#FFF',marginBottom:6}}>Tell Aibram{'\n'}about yourself.</Text>
          <Text style={{color:C.sub,fontSize:14,marginBottom:36,lineHeight:22}}>This helps Aibram give advice that's actually relevant to your life.</Text>
          <Text style={S.sectionLabel}>HOW OLD ARE YOU?</Text>
          <View style={{backgroundColor:'rgba(255,255,255,0.04)',borderRadius:16,borderWidth:1,borderColor:C.line,marginBottom:32,paddingVertical:8}}><AgePicker value={age} onChange={setAge}/></View>
          {[{label:'SHORT-TERM GOALS',hint:'What do you want in the next few weeks?',chips:sugg.short,arr:shortGoals,setArr:setShortGoals,custom:customShort,setCustom:setCustomShort},{label:'MID-TERM GOALS',hint:'The next few months to a year.',chips:sugg.mid,arr:midGoals,setArr:setMidGoals,custom:customMid,setCustom:setCustomMid},{label:'LONG-TERM GOALS',hint:'Where do you want to end up?',chips:sugg.long,arr:longGoals,setArr:setLongGoals,custom:customLong,setCustom:setCustomLong}].map((section,si)=>(
            <View key={si}>
              <Text style={[S.sectionLabel,{marginTop:si>0?28:0}]}>{section.label}</Text>
              <Text style={{color:C.sub,fontSize:12,marginBottom:12}}>{section.hint}</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:10}}>
                {section.chips.map((s: string)=><Chip key={s} label={s} selected={section.arr.includes(s)} onPress={()=>toggleMulti(section.arr,section.setArr,s)}/>)}
                {section.arr.filter(g=>!section.chips.includes(g)).map((g: string)=><Chip key={g} label={g} selected onPress={()=>toggleMulti(section.arr,section.setArr,g)}/>)}
              </View>
              <View style={S.customRow}><TextInput style={S.customInput} value={section.custom} onChangeText={section.setCustom} placeholder="Add your own..." placeholderTextColor={C.sub} returnKeyType="done" onSubmitEditing={()=>addCustom(section.arr,section.setArr,section.custom,section.setCustom)}/><TouchableOpacity onPress={()=>addCustom(section.arr,section.setArr,section.custom,section.setCustom)} style={{padding:8}}><Ionicons name="add-circle" size={28} color={C.primary}/></TouchableOpacity></View>
            </View>
          ))}
          <Text style={[S.sectionLabel,{marginTop:28}]}>INTERESTS</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:8}}>{INTERESTS.map(s=><Chip key={s} label={s} selected={interests.includes(s)} onPress={()=>toggleMulti(interests,setInterests,s)}/>)}</View>
          <Text style={[S.sectionLabel,{marginTop:28}]}>BIGGEST STRUGGLE</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:8}}>{sugg.struggles.map((s: string)=><Chip key={s} label={s} selected={struggle===s} onPress={()=>{Haptics.selectionAsync();setStruggle(s);}}/>)}</View>
          <TouchableOpacity style={[S.primaryBtn,{marginTop:36,opacity:saving?0.6:1}]} onPress={handleComplete} disabled={saving}>
            {saving?<ActivityIndicator color={C.bg}/>:<Text style={S.btnTxt}>Set my heading →</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const OnboardScreen4 = ({ name, profile, onDone }: any) => {
  const [greeting,setGreeting]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{generateGreeting(name,profile).then(t=>{setGreeting(t);setLoading(false);});},[]);
  return (
    <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={[S.screen,{justifyContent:'center',alignItems:'center',padding:32}]}>
      <StatusBar barStyle="light-content"/>
      <PulsingOrb size={80} color={C.primary} isThinking={loading}/>
      <Text style={{color:loading?C.thinking:C.primary,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:2,marginTop:16,marginBottom:40}}>{loading?'AIBRAM IS THINKING...':'AIBRAM'}</Text>
      {loading?<Text style={{color:C.sub,fontSize:14}}>Getting to know you...</Text>:(
        <TouchableOpacity onPress={onDone} activeOpacity={0.8} style={{alignItems:'center'}}>
          <TypingText text={greeting} onDone={onDone}/>
          <Text style={{color:C.sub,fontSize:12,marginTop:32}}>Tap to continue</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
};

const OnboardScreen5 = ({ name, profile, onComplete }: any) => {
  const [suggestions,setSuggestions]=useState<any[]>([]),[loading,setLoading]=useState(true),[selected,setSelected]=useState<Record<number,boolean>>({}),[dates,setDates]=useState<Record<number,string>>({});
  useEffect(()=>{generateTaskSuggestions(name,profile).then(suggs=>{setSuggestions(suggs);const s: Record<number,boolean>={},d: Record<number,string>={};suggs.forEach((sg: any,i: number)=>{s[i]=true;d[i]=suggestedDateToIso(sg.suggestedDate);});setSelected(s);setDates(d);setLoading(false);});},[]);
  const handleComplete=()=>{const tasks=suggestions.filter((_: any,i: number)=>selected[i]).map((s: any,i: number)=>({id:Date.now().toString()+i,text:s.text,completed:false,date:dates[i]||today(),timeLabel:null,subtasks:[]}));onComplete(tasks);};
  return (
    <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={S.screen}>
      <StatusBar barStyle="light-content"/>
      <ScrollView contentContainerStyle={{padding:28,paddingTop:64,paddingBottom:120}}>
        <View style={{alignItems:'center',marginBottom:28}}><PulsingOrb size={60} color={C.primary} isThinking={loading}/><Text style={{color:C.primary,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:2,marginTop:12}}>AIBRAM</Text></View>
        <Text style={{fontSize:24,fontFamily:'Inter_900Black',color:'#FFF',marginBottom:8}}>Here's where{'\n'}I'd start.</Text>
        <Text style={{color:C.sub,fontSize:14,lineHeight:22,marginBottom:28}}>Based on your goals. Pick the ones that fit.</Text>
        {loading?(<View style={{alignItems:'center',marginTop:40}}><ActivityIndicator color={C.primary}/><Text style={{color:C.sub,marginTop:16}}>Generating your tasks...</Text></View>):(
          suggestions.map((s: any,i: number)=>(
            <TouchableOpacity key={i} onPress={()=>{Haptics.selectionAsync();setSelected(p=>({...p,[i]:!p[i]}));}} style={{backgroundColor:selected[i]?'rgba(77,150,255,0.08)':'rgba(255,255,255,0.03)',borderRadius:14,padding:16,marginBottom:12,borderWidth:1.5,borderColor:selected[i]?C.primary:'rgba(255,255,255,0.08)'}}>
              <View style={{flexDirection:'row',alignItems:'flex-start',marginBottom:8}}>
                <Ionicons name={selected[i]?'checkbox':'square-outline'} size={22} color={selected[i]?C.primary:C.sub} style={{marginRight:12,marginTop:1}}/>
                <View style={{flex:1}}><Text style={{color:'#FFF',fontFamily:'Inter_700Bold',fontSize:15,marginBottom:4}}>{s.text}</Text><Text style={{color:C.sub,fontSize:12,lineHeight:18}}>{s.why}</Text></View>
              </View>
              <View style={{flexDirection:'row',alignItems:'center',marginLeft:34,gap:8}}>
                <Ionicons name="calendar-outline" size={14} color={C.primary}/>
                <Text style={{color:C.primary,fontSize:12}}>{dates[i]===today()?'Today':dates[i]===dayOffset(1)?'Tomorrow':dates[i]}</Text>
                <TouchableOpacity onPress={()=>setDates(p=>({...p,[i]:today()}))} style={{marginLeft:8,paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:'rgba(77,150,255,0.1)',borderWidth:1,borderColor:'rgba(77,150,255,0.2)'}}><Text style={{color:C.primary,fontSize:11}}>Today</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>setDates(p=>({...p,[i]:dayOffset(1)}))} style={{paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:'rgba(77,150,255,0.1)',borderWidth:1,borderColor:'rgba(77,150,255,0.2)'}}><Text style={{color:C.primary,fontSize:11}}>Tomorrow</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
        {!loading&&(<><TouchableOpacity style={[S.primaryBtn,{marginTop:20}]} onPress={handleComplete}><Text style={S.btnTxt}>Add selected tasks →</Text></TouchableOpacity><TouchableOpacity onPress={()=>onComplete([])} style={{alignItems:'center',marginTop:8}}><Text style={{color:C.sub,fontSize:13}}>Skip for now</Text></TouchableOpacity></>)}
      </ScrollView>
    </LinearGradient>
  );
};

const OnboardScreen6 = ({ onAllow, onSkip }: any) => (
  <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={[S.screen,{justifyContent:'center',alignItems:'center',padding:32}]}>
    <StatusBar barStyle="light-content"/>
    <View style={{width:80,height:80,borderRadius:40,backgroundColor:'rgba(77,150,255,0.12)',justifyContent:'center',alignItems:'center',marginBottom:24}}><Ionicons name="notifications-outline" size={36} color={C.primary}/></View>
    <Text style={{fontSize:26,fontFamily:'Inter_900Black',color:'#FFF',textAlign:'center',marginBottom:12}}>Stay on track</Text>
    <Text style={{color:C.sub,fontSize:15,textAlign:'center',lineHeight:24,marginBottom:48}}>Aibram can remind you when tasks are due and make sure you don't break your streak.</Text>
    <TouchableOpacity style={[S.primaryBtn,{width:'100%'}]} onPress={onAllow}><Text style={S.btnTxt}>Allow Notifications</Text></TouchableOpacity>
    <TouchableOpacity onPress={onSkip} style={{marginTop:16}}><Text style={{color:C.sub,fontSize:14}}>Not now</Text></TouchableOpacity>
  </LinearGradient>
);

// ─── SPACE SCREEN ─────────────────────────────────────────────────────────────
const IDEA_STATES = ['All','Raw','Expanded','Linked','Promoted'] as const;
type IdeaState = 'Raw' | 'Expanded' | 'Linked' | 'Promoted';

interface Idea {
  id: string;
  text: string;
  notes: string;
  state: IdeaState;
  linkedGoal: string | null;
  promotedTaskId: string | null;
  threadCount: number;
  createdAt: string;
}

const SpaceScreen = ({ goals, setGoals, profile, setPendingMsg, setTab }: any) => {
  const [ideas,setIdeas]=useState<Idea[]>([]),[filter,setFilter]=useState<typeof IDEA_STATES[number]>('All'),[input,setInput]=useState(''),[expandedId,setExpandedId]=useState<string|null>(null),[editingNotes,setEditingNotes]=useState<string|null>(null),[notesText,setNotesText]=useState(''),[linkingId,setLinkingId]=useState<string|null>(null),[kbVis,setKbVis]=useState(false);

  useEffect(()=>{loadFromFirestore('space').then(saved=>{if(saved)setIdeas(saved);});},[]);
  useEffect(()=>{const s=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',()=>setKbVis(true));const h=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>setKbVis(false));return()=>{s.remove();h.remove();};},[]);

  const saveIdeas=async(updated: Idea[])=>{setIdeas(updated);await saveToFirestore('space',updated);};

  const addIdea=async()=>{
    if(!input.trim())return;
    const newIdea: Idea={id:Date.now().toString(),text:input.trim(),notes:'',state:'Raw',linkedGoal:null,promotedTaskId:null,threadCount:0,createdAt:new Date().toISOString()};
    await saveIdeas([newIdea,...ideas]);
    setInput('');Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);Keyboard.dismiss();
  };

  const deleteIdea=(id: string)=>Alert.alert('Delete idea?',"This can't be undone.",[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>saveIdeas(ideas.filter(i=>i.id!==id))}]);

  const expandIdea=(idea: Idea)=>{
    if(idea.state==='Raw'){
      const updated=ideas.map(i=>i.id===idea.id?{...i,state:'Expanded' as IdeaState}:i);
      saveIdeas(updated);
    }
    setExpandedId(expandedId===idea.id?null:idea.id);
    setEditingNotes(null);
  };

  const saveNotes=async(id: string)=>{
    await saveIdeas(ideas.map(i=>i.id===id?{...i,notes:notesText}:i));
    setEditingNotes(null);Keyboard.dismiss();
  };

  const promoteToTask=async(idea: Idea)=>{
    const newTask={id:Date.now().toString(),text:idea.text,completed:false,date:today(),timeLabel:null,subtasks:[]};
    const newGoals=[...goals,newTask];setGoals(newGoals);await saveToFirestore('goals',newGoals);
    await saveIdeas(ideas.map(i=>i.id===idea.id?{...i,state:'Promoted' as IdeaState,promotedTaskId:newTask.id}:i));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Added to Tasks','This idea has been added to today\'s task list.');
  };

  const linkGoal=(ideaId: string,goal: string)=>{
    saveIdeas(ideas.map(i=>i.id===ideaId?{...i,state:'Linked' as IdeaState,linkedGoal:goal}:i));
    setLinkingId(null);
  };

  const askAibram=(idea: Idea)=>{
    saveIdeas(ideas.map(i=>i.id===idea.id?{...i,threadCount:i.threadCount+1}:i));
    setPendingMsg(`[IDEA_CONTEXT:${idea.text}]`);
    setTab('Aibram');
  };

  const allGoalsList=[
    ...(profile?.shortTermGoals||[]),
    ...(profile?.midTermGoals||[]),
    ...(profile?.longTermGoals||[]),
  ];

  const filtered=filter==='All'?ideas:ideas.filter(i=>i.state===filter);

  const STATE_COLORS: Record<string,string> = {
    Raw:'rgba(127,90,240,0.4)',Expanded:C.primary,Linked:C.success,Promoted:'rgba(255,255,255,0.2)',
  };

  const timeAgo=(dateStr: string)=>{
    const diff=Date.now()-new Date(dateStr).getTime();
    if(diff<60000)return'just now';
    if(diff<3600000)return`${Math.floor(diff/60000)}m ago`;
    if(diff<86400000)return`${Math.floor(diff/3600000)}h ago`;
    return`${Math.floor(diff/86400000)}d ago`;
  };

  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
      <View style={S.pageHead}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'}}>
          <View>
            <Text style={S.pageTitle}>Space</Text>
            <Text style={{color:C.sub,fontSize:12,marginTop:2}}>Your space to think</Text>
          </View>
          <View style={{backgroundColor:'rgba(127,90,240,0.12)',borderWidth:1,borderColor:'rgba(127,90,240,0.28)',borderRadius:8,paddingHorizontal:10,paddingVertical:5}}>
            <Text style={{fontSize:12,color:C.accent}}>{ideas.length} {ideas.length===1?'idea':'ideas'}</Text>
          </View>
        </View>
      </View>

      {/* Quick input */}
      <View style={{marginHorizontal:20,marginBottom:12,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.05)',borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',paddingHorizontal:14,paddingVertical:4}}>
        <TextInput style={{flex:1,color:'#FFF',fontSize:14,paddingVertical:12}} placeholder="Throw something in..." placeholderTextColor={C.sub} value={input} onChangeText={setInput} returnKeyType="done" onSubmitEditing={addIdea}/>
        <TouchableOpacity onPress={addIdea} style={{padding:4}}>
          <Ionicons name="add-circle" size={28} color={input.trim()?C.accent:C.sub}/>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:20,marginBottom:12,flexGrow:0}} contentContainerStyle={{gap:8,paddingRight:20}}>
        {IDEA_STATES.map(f=>(
          <TouchableOpacity key={f} onPress={()=>setFilter(f)} style={{paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:1,borderColor:filter===f?C.accent:'rgba(255,255,255,0.1)',backgroundColor:filter===f?'rgba(127,90,240,0.12)':'transparent'}}>
            <Text style={{fontSize:13,color:filter===f?C.accent:C.sub,fontFamily:'Inter_700Bold'}}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:kbVis?20:100}} keyboardShouldPersistTaps="handled">
        {filtered.length===0&&(
          <Text style={{color:C.sub,textAlign:'center',marginTop:40,opacity:0.6,lineHeight:22}}>
            {filter==='All'?'Nothing here yet.\nThrow your first idea in above.':
             `No ${filter.toLowerCase()} ideas yet.`}
          </Text>
        )}

        {filtered.map(idea=>{
          const isExpanded=expandedId===idea.id;
          const borderColor=STATE_COLORS[idea.state]||C.sub;
          return (
            <View key={idea.id} style={{backgroundColor:idea.state==='Promoted'?'rgba(255,255,255,0.02)':idea.state==='Linked'?'rgba(44,182,125,0.05)':idea.state==='Expanded'?'rgba(77,150,255,0.05)':'rgba(127,90,240,0.05)',borderRadius:14,borderWidth:1,borderColor:idea.state==='Promoted'?'rgba(255,255,255,0.06)':idea.state==='Linked'?'rgba(44,182,125,0.2)':idea.state==='Expanded'?'rgba(77,150,255,0.2)':'rgba(127,90,240,0.2)',marginBottom:12,overflow:'hidden'}}>

              {/* Left state bar */}
              <View style={{position:'absolute',left:0,top:0,bottom:0,width:3,backgroundColor:borderColor,borderRadius:0}}/>

              <View style={{padding:14,paddingLeft:17}}>
                {/* Header row */}
                <View style={{flexDirection:'row',alignItems:'flex-start',marginBottom:8}}>
                  <Text style={{color:idea.state==='Promoted'?C.sub:'#FFF',fontSize:14,flex:1,lineHeight:20,textDecorationLine:idea.state==='Promoted'?'line-through':'none',fontFamily:'Inter_700Bold'}}>{idea.text}</Text>
                  <TouchableOpacity onPress={()=>deleteIdea(idea.id)} style={{padding:4,marginLeft:8}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <Ionicons name="close" size={16} color={C.sub}/>
                  </TouchableOpacity>
                </View>

                {/* Meta row */}
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10}}>
                  <View style={{paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:idea.state==='Raw'?'rgba(127,90,240,0.15)':idea.state==='Expanded'?'rgba(77,150,255,0.15)':idea.state==='Linked'?'rgba(44,182,125,0.15)':'rgba(255,255,255,0.08)'}}>
                    <Text style={{fontSize:11,color:idea.state==='Raw'?C.accent:idea.state==='Expanded'?C.primary:idea.state==='Linked'?C.success:C.sub,fontFamily:'Inter_700Bold'}}>{idea.state}</Text>
                  </View>
                  {idea.linkedGoal&&<Text style={{fontSize:11,color:C.success}}>→ {idea.linkedGoal}</Text>}
                  {idea.threadCount>0&&<Text style={{fontSize:11,color:C.primary,marginLeft:'auto'}}>{idea.threadCount} thread{idea.threadCount>1?'s':''}</Text>}
                  <Text style={{fontSize:11,color:C.sub,marginLeft:idea.threadCount>0?0:'auto'}}>{timeAgo(idea.createdAt)}</Text>
                </View>

                {/* Notes preview (Expanded) */}
                {idea.state==='Expanded'&&idea.notes&&!isExpanded&&(
                  <Text style={{color:C.sub,fontSize:12,lineHeight:18,marginBottom:8}} numberOfLines={2}>{idea.notes}</Text>
                )}

                {/* Expanded section */}
                {isExpanded&&(
                  <View style={{borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.06)',paddingTop:12,marginBottom:8}}>
                    {editingNotes===idea.id?(
                      <View>
                        <TextInput style={{color:'#FFF',fontSize:13,lineHeight:20,borderWidth:1,borderColor:C.primary,borderRadius:10,padding:10,minHeight:80,textAlignVertical:'top',backgroundColor:'rgba(255,255,255,0.04)'}} value={notesText} onChangeText={setNotesText} multiline autoFocus placeholder="Expand your thoughts..." placeholderTextColor={C.sub}/>
                        <View style={{flexDirection:'row',gap:8,marginTop:8}}>
                          <TouchableOpacity style={{flex:1,backgroundColor:C.primary,borderRadius:8,padding:8,alignItems:'center'}} onPress={()=>saveNotes(idea.id)}><Text style={{color:'#050B14',fontFamily:'Inter_700Bold',fontSize:13}}>Save notes</Text></TouchableOpacity>
                          <TouchableOpacity style={{flex:0.4,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',borderRadius:8,padding:8,alignItems:'center'}} onPress={()=>setEditingNotes(null)}><Text style={{color:C.sub,fontSize:13}}>Cancel</Text></TouchableOpacity>
                        </View>
                      </View>
                    ):(
                      <TouchableOpacity onPress={()=>{setEditingNotes(idea.id);setNotesText(idea.notes);}}>
                        {idea.notes?(
                          <Text style={{color:C.text,fontSize:13,lineHeight:20}}>{idea.notes}</Text>
                        ):(
                          <Text style={{color:C.sub,fontSize:13,fontStyle:'italic'}}>Tap to add notes...</Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Goal linking */}
                    {linkingId===idea.id&&(
                      <View style={{marginTop:10}}>
                        <Text style={{color:C.sub,fontSize:11,marginBottom:6}}>Link to a goal:</Text>
                        {allGoalsList.map(g=>(
                          <TouchableOpacity key={g} onPress={()=>linkGoal(idea.id,g)} style={{padding:8,borderRadius:8,backgroundColor:'rgba(44,182,125,0.08)',borderWidth:1,borderColor:'rgba(44,182,125,0.2)',marginBottom:6}}>
                            <Text style={{color:C.success,fontSize:13}}>{g}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={()=>setLinkingId(null)} style={{padding:8,alignItems:'center'}}><Text style={{color:C.sub,fontSize:12}}>Cancel</Text></TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Action buttons */}
                {idea.state!=='Promoted'&&(
                  <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
                    {idea.state==='Raw'&&(
                      <TouchableOpacity onPress={()=>expandIdea(idea)} style={{paddingHorizontal:10,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'rgba(127,90,240,0.3)',backgroundColor:'rgba(127,90,240,0.08)'}}>
                        <Text style={{fontSize:12,color:C.accent}}>Expand</Text>
                      </TouchableOpacity>
                    )}
                    {(idea.state==='Expanded'||idea.state==='Raw')&&(
                      <TouchableOpacity onPress={()=>expandIdea(idea)} style={{paddingHorizontal:10,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',backgroundColor:'rgba(255,255,255,0.04)'}}>
                        <Text style={{fontSize:12,color:C.sub}}>{isExpanded?'Collapse':'View notes'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={()=>askAibram(idea)} style={{paddingHorizontal:10,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'rgba(77,150,255,0.3)',backgroundColor:'rgba(77,150,255,0.08)'}}>
                      <Text style={{fontSize:12,color:C.primary}}>Ask Aibram</Text>
                    </TouchableOpacity>
                    {idea.state!=='Linked'&&allGoalsList.length>0&&(
                      <TouchableOpacity onPress={()=>{setLinkingId(idea.id);setExpandedId(idea.id);}} style={{paddingHorizontal:10,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'rgba(44,182,125,0.3)',backgroundColor:'rgba(44,182,125,0.08)'}}>
                        <Text style={{fontSize:12,color:C.success}}>Link goal</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={()=>promoteToTask(idea)} style={{paddingHorizontal:10,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'rgba(255,137,6,0.3)',backgroundColor:'rgba(255,137,6,0.08)'}}>
                      <Text style={{fontSize:12,color:C.warning}}>→ Task</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {idea.state==='Promoted'&&(
                  <Text style={{fontSize:12,color:C.sub,fontStyle:'italic'}}>Promoted to task</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── FOCUS SCREEN (rebuilt) ───────────────────────────────────────────────────
const FOCUS_DURS = [5,10,15,25];
const SOUND_NAMES = ['Rain','Lo-fi','White noise','Forest'];
const MIND_STYLES = ['Breathing','Body scan','Grounding'];

const FocusScreen = ({ addXp, setMsg, nav, goals }: any) => {
  const [mode,setMode]=useState<'focus'|'mindfulness'|null>(null);
  const [dur,setDur]=useState(25),[sound,setSound]=useState<string|null>(null),[mindStyle,setMindStyle]=useState('Breathing');
  const [intent,setIntent]=useState(''),[intentMode,setIntentMode]=useState<'task'|'custom'>('task'),[showIntentPicker,setShowIntentPicker]=useState(false);
  const [phase,setPhase]=useState<'picker'|'active'|'done'>('picker');
  const [secs,setSecs]=useState(0),[breath,setBreath]=useState('Inhale...');
  const [soundObj,setSoundObj]=useState<Audio.Sound|null>(null);
  const tRef=useRef<any>(null),bRef=useRef<any>(null),aRef=useRef<any>(null);
  const sc=useRef(new Animated.Value(1)).current;
  const fmt=(s: number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const todayGoals=goals.filter((g: any)=>g.date===today()&&!g.completed);

  // Sound management
  const playSound=async(name: string)=>{
    try{
      if(soundObj){await soundObj.unloadAsync();setSoundObj(null);}
      const {sound:s}=await Audio.Sound.createAsync(SOUNDS[name],{isLooping:true,volume:0.4});
      await s.playAsync();setSoundObj(s);
    }catch(e){console.log('Sound error:',e);}
  };

  const stopSound=async()=>{
    if(soundObj){try{await soundObj.stopAsync();await soundObj.unloadAsync();}catch{}setSoundObj(null);}
  };

  useEffect(()=>{
    if(sound){playSound(sound);}else{stopSound();}
    return()=>{stopSound();};
  },[sound]);

  useEffect(()=>()=>{stopSound();},[]);

  const cycle=()=>{setBreath('Inhale...');bRef.current=setTimeout(()=>{setBreath('Hold...');bRef.current=setTimeout(()=>{setBreath('Exhale...');bRef.current=setTimeout(()=>{setBreath('Rest...');bRef.current=setTimeout(cycle,1000);},4000);},2000);},4000);};

  const startFocus=()=>{
    const total=dur*60;setSecs(total);setPhase('active');let rem=total;
    tRef.current=setInterval(()=>{rem--;setSecs(rem);if(rem<=0){clearInterval(tRef.current);clearTimeout(bRef.current);if(aRef.current)aRef.current.stop();sc.setValue(1);setPhase('done');addXp(50);stopSound();Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);}},1000);
    aRef.current=Animated.loop(Animated.sequence([Animated.timing(sc,{toValue:1.5,duration:4000,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.delay(2000),Animated.timing(sc,{toValue:1,duration:4000,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.delay(1000)]));
    aRef.current.start();cycle();
  };

  const startMindfulness=()=>{setPhase('active');cycle();};

  const stopSession=()=>{
    clearInterval(tRef.current);clearTimeout(bRef.current);
    if(aRef.current)aRef.current.stop();sc.setValue(1);
    setPhase('picker');stopSound();
  };

  useEffect(()=>()=>{clearInterval(tRef.current);clearTimeout(bRef.current);},[]);

  // Mindfulness orb pulses slower and purple
  const mindScale=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    if(phase==='active'&&mode==='mindfulness'){
      Animated.loop(Animated.sequence([Animated.timing(mindScale,{toValue:1.4,duration:4000,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.delay(2000),Animated.timing(mindScale,{toValue:1,duration:4000,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.delay(1000)])).start();
    } else { mindScale.setValue(1); }
  },[phase,mode]);

  if(phase==='active'&&mode==='focus'){
    return (
      <View style={[S.screen,{justifyContent:'center',alignItems:'center'}]}>
        <Text style={[S.pageTitle,{position:'absolute',top:60}]}>Deep Focus</Text>
        {intent!==''&&<Text style={{position:'absolute',top:102,color:C.sub,fontSize:12}}>Working on: {intent}</Text>}
        <Animated.View style={{width:260,height:260,borderRadius:130,backgroundColor:C.holo,transform:[{scale:sc}],opacity:0.3,position:'absolute'}}/>
        <Animated.View style={{width:210,height:210,borderRadius:105,borderWidth:2,borderColor:C.primary,backgroundColor:'rgba(77,150,255,0.1)',justifyContent:'center',alignItems:'center',transform:[{scale:sc}]}}>
          <Text style={{color:C.sub,fontSize:13,fontFamily:'Inter_700Bold',marginBottom:8}}>{breath}</Text>
          <Text style={{color:'#FFF',fontSize:34,fontFamily:'Inter_900Black'}}>{fmt(secs)}</Text>
        </Animated.View>
        {sound&&<View style={{position:'absolute',bottom:120,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:20,paddingHorizontal:14,paddingVertical:6}}><Ionicons name="musical-notes-outline" size={14} color={C.sub}/><Text style={{color:C.sub,fontSize:12}}>{sound}</Text></View>}
        <TouchableOpacity onPress={stopSession} style={{position:'absolute',bottom:100,padding:12}}><Text style={{color:C.sub,fontSize:12}}>End session early</Text></TouchableOpacity>
      </View>
    );
  }

  if(phase==='active'&&mode==='mindfulness'){
    return (
      <View style={[S.screen,{justifyContent:'center',alignItems:'center'}]}>
        <Text style={[S.pageTitle,{position:'absolute',top:60,color:C.accent}]}>Mindfulness</Text>
        <Text style={{position:'absolute',top:102,color:C.sub,fontSize:12}}>{mindStyle}</Text>

        {/* Concentric rings */}
        <View style={{position:'relative',width:220,height:220,justifyContent:'center',alignItems:'center',marginBottom:32}}>
          {[220,170,120].map((size,i)=>(
            <Animated.View key={i} style={{position:'absolute',width:size,height:size,borderRadius:size/2,borderWidth:1,borderColor:`rgba(127,90,240,${0.15+i*0.1})`,transform:[{scale:i===0?mindScale:1}]}}/>
          ))}
          <PulsingOrb size={64} color={C.accent} colorOverride={C.accent}/>
        </View>

        <Text style={{color:'#FFF',fontSize:24,fontFamily:'Inter_900Black',marginBottom:8}}>{breath}</Text>
        <Text style={{color:C.sub,fontSize:14,marginBottom:36}}>Take your time. No rush.</Text>

        {sound&&<View style={{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:20,paddingHorizontal:14,paddingVertical:6,marginBottom:20}}><Ionicons name="musical-notes-outline" size={14} color={C.sub}/><Text style={{color:C.sub,fontSize:12}}>{sound}</Text></View>}

        <TouchableOpacity onPress={()=>{stopSession();addXp(20);setPhase('done');}} style={{backgroundColor:C.accent,paddingHorizontal:32,paddingVertical:14,borderRadius:24}}>
          <Text style={{color:'#FFF',fontFamily:'Inter_700Bold',fontSize:15}}>I'm done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if(phase==='done'){
    return (
      <View style={[S.screen,{justifyContent:'center',alignItems:'center',paddingHorizontal:30}]}>
        <Ionicons name="checkmark-circle" size={64} color={mode==='mindfulness'?C.accent:C.success}/>
        <Text style={{color:'#FFF',fontFamily:'Inter_900Black',fontSize:22,marginTop:20,textAlign:'center'}}>
          {mode==='mindfulness'?'Session complete. How do you feel?':`You stayed locked in for ${dur} min.`}
        </Text>
        <Text style={{color:mode==='mindfulness'?C.accent:C.success,fontFamily:'Inter_700Bold',fontSize:14,marginTop:8}}>+{mode==='mindfulness'?20:50} XP earned</Text>
        {mode==='focus'&&<Text style={{color:C.sub,marginTop:8,textAlign:'center'}}>Keep that energy going.</Text>}
        <TouchableOpacity onPress={()=>{setMsg(`I just finished a ${mode==='mindfulness'?'mindfulness':dur+' minute focus'} session. ${mode==='mindfulness'?'How do I carry this calm into my work?':'How do I keep this momentum going?'}`);nav('Aibram');}} style={{backgroundColor:mode==='mindfulness'?C.accent:C.primary,paddingHorizontal:32,paddingVertical:14,borderRadius:24,marginTop:30}}>
          <Text style={{color:mode==='mindfulness'?'#FFF':'#000',fontFamily:'Inter_700Bold',fontSize:15}}>Tell Aibram →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{setPhase('picker');setMode(null);sc.setValue(1);}} style={{marginTop:18}}>
          <Text style={{color:C.sub}}>Go again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Picker
  return (
    <ScrollView style={S.screen} contentContainerStyle={{padding:20,paddingTop:60,paddingBottom:120}}>
      <Text style={S.pageTitle}>Focus</Text>
      <Text style={{color:C.sub,fontSize:13,marginTop:4,marginBottom:24}}>Choose your session type</Text>

      {/* Mode cards */}
      <TouchableOpacity onPress={()=>setMode(mode==='focus'?null:'focus')} style={{borderRadius:16,borderWidth:1.5,borderColor:mode==='focus'?C.primary:'rgba(255,255,255,0.1)',backgroundColor:mode==='focus'?'rgba(77,150,255,0.08)':'rgba(255,255,255,0.03)',padding:16,marginBottom:12}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:mode==='focus'?14:0}}>
          <View style={{width:40,height:40,borderRadius:12,backgroundColor:'rgba(77,150,255,0.15)',justifyContent:'center',alignItems:'center'}}>
            <Ionicons name="timer-outline" size={20} color={C.primary}/>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:mode==='focus'?C.primary:'#FFF',fontFamily:'Inter_700Bold',fontSize:15}}>Deep Focus</Text>
            <Text style={{color:C.sub,fontSize:12,marginTop:2}}>Countdown timer · task intent · breathing</Text>
          </View>
          {mode==='focus'&&<Ionicons name="checkmark-circle" size={20} color={C.primary}/>}
        </View>
        {mode==='focus'&&(
          <View>
            <Text style={{color:C.sub,fontSize:11,letterSpacing:1.2,marginBottom:8}}>DURATION</Text>
            <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
              {FOCUS_DURS.map(d=>(
                <TouchableOpacity key={d} onPress={()=>setDur(d)} style={{paddingVertical:8,paddingHorizontal:12,borderRadius:10,borderWidth:1.5,borderColor:dur===d?C.primary:'rgba(255,255,255,0.1)',backgroundColor:dur===d?'rgba(77,150,255,0.15)':'transparent'}}>
                  <Text style={{color:dur===d?C.primary:C.sub,fontFamily:'Inter_700Bold',fontSize:14}}>{d}<Text style={{fontSize:11}}> min</Text></Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{color:C.sub,fontSize:11,letterSpacing:1.2,marginBottom:8}}>WORKING ON</Text>
            <TouchableOpacity onPress={()=>setShowIntentPicker(!showIntentPicker)} style={{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.05)',borderRadius:10,padding:12,marginBottom:showIntentPicker?0:0,borderWidth:1,borderColor:'rgba(255,255,255,0.1)'}}>
              <Ionicons name="create-outline" size={16} color={intent?C.primary:C.sub} style={{marginRight:8}}/>
              <Text style={{color:intent?C.primary:C.sub,flex:1,fontSize:13}}>{intent||'What are you working on?'}</Text>
              <Ionicons name={showIntentPicker?'chevron-up':'chevron-down'} size={16} color={C.sub}/>
            </TouchableOpacity>
            {showIntentPicker&&(
              <View style={{backgroundColor:'rgba(255,255,255,0.04)',borderRadius:10,borderWidth:1,borderColor:'rgba(255,255,255,0.08)',marginBottom:0,marginTop:4}}>
                {todayGoals.slice(0,5).map((g: any)=>(
                  <TouchableOpacity key={g.id} onPress={()=>{setIntent(g.text);setShowIntentPicker(false);}} style={{padding:12,borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.05)'}}>
                    <Text style={{color:C.text,fontSize:13}}>{g.text}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{flexDirection:'row',alignItems:'center',padding:12}}>
                  <TextInput style={{flex:1,color:'#FFF',fontSize:13}} placeholder="Type custom intent..." placeholderTextColor={C.sub} onSubmitEditing={(e)=>{setIntent(e.nativeEvent.text);setShowIntentPicker(false);}} returnKeyType="done"/>
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={()=>setMode(mode==='mindfulness'?null:'mindfulness')} style={{borderRadius:16,borderWidth:1.5,borderColor:mode==='mindfulness'?C.accent:'rgba(255,255,255,0.1)',backgroundColor:mode==='mindfulness'?'rgba(127,90,240,0.08)':'rgba(255,255,255,0.03)',padding:16,marginBottom:20}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:mode==='mindfulness'?14:0}}>
          <View style={{width:40,height:40,borderRadius:12,backgroundColor:'rgba(127,90,240,0.15)',justifyContent:'center',alignItems:'center'}}>
            <Ionicons name="leaf-outline" size={20} color={C.accent}/>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:mode==='mindfulness'?C.accent:'#FFF',fontFamily:'Inter_700Bold',fontSize:15}}>Mindfulness</Text>
            <Text style={{color:C.sub,fontSize:12,marginTop:2}}>No timer · breathe at your own pace</Text>
          </View>
          {mode==='mindfulness'&&<Ionicons name="checkmark-circle" size={20} color={C.accent}/>}
        </View>
        {mode==='mindfulness'&&(
          <View>
            <Text style={{color:C.sub,fontSize:11,letterSpacing:1.2,marginBottom:8}}>STYLE</Text>
            <View style={{flexDirection:'row',gap:8}}>
              {MIND_STYLES.map(s=>(
                <TouchableOpacity key={s} onPress={()=>setMindStyle(s)} style={{paddingVertical:8,paddingHorizontal:12,borderRadius:10,borderWidth:1.5,borderColor:mindStyle===s?C.accent:'rgba(255,255,255,0.1)',backgroundColor:mindStyle===s?'rgba(127,90,240,0.15)':'transparent'}}>
                  <Text style={{color:mindStyle===s?C.accent:C.sub,fontSize:12,fontFamily:'Inter_700Bold'}}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Shared sound picker */}
      {mode&&(
        <View>
          <Text style={{color:C.sub,fontSize:11,letterSpacing:1.2,marginBottom:10}}>AMBIENT SOUND</Text>
          <View style={{flexDirection:'row',gap:8,marginBottom:24}}>
            {SOUND_NAMES.map(s=>(
              <TouchableOpacity key={s} onPress={()=>setSound(sound===s?null:s)} style={{flex:1,paddingVertical:10,borderRadius:10,alignItems:'center',borderWidth:1,borderColor:sound===s?(mode==='mindfulness'?C.accent:C.primary):'rgba(255,255,255,0.1)',backgroundColor:sound===s?(mode==='mindfulness'?'rgba(127,90,240,0.1)':'rgba(77,150,255,0.1)'):'rgba(255,255,255,0.03)'}}>
                <Text style={{fontSize:11,color:sound===s?(mode==='mindfulness'?C.accent:C.primary):C.sub,fontFamily:'Inter_700Bold'}}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={mode==='focus'?startFocus:startMindfulness} style={{backgroundColor:mode==='mindfulness'?C.accent:C.primary,paddingVertical:16,borderRadius:30,alignItems:'center'}}>
            <Text style={{color:mode==='mindfulness'?'#FFF':'#000',fontFamily:'Inter_700Bold',fontSize:16}}>
              {mode==='focus'?'Locked in. Let\'s go.':'Begin session'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!mode&&(
        <Text style={{color:C.sub,fontSize:13,textAlign:'center',marginTop:8,opacity:0.6}}>Select a mode above to get started</Text>
      )}
    </ScrollView>
  );
};

// ─── AIBRAM SCREEN ────────────────────────────────────────────────────────────
const AibramScreen = ({ userData, addXp, pendingMsg, clearPending, goals, setGoals, xp, nav, profile, energy }: any) => {
  const scrollRef=useRef<any>();
  const [msgs,setMsgs]=useState<any[]>([]),[input,setInput]=useState(''),[thinking,setThinking]=useState(false),[kbVis,setKbVis]=useState(false),[loaded,setLoaded]=useState(false),[ideaContext,setIdeaContext]=useState<string|null>(null);
  const dot=useRef(new Animated.Value(0)).current,rank=getRank(xp);

  useEffect(()=>{if(thinking){Animated.loop(Animated.sequence([Animated.timing(dot,{toValue:1,duration:500,useNativeDriver:true}),Animated.timing(dot,{toValue:0,duration:500,useNativeDriver:true})])).start();}else{dot.stopAnimation();dot.setValue(0);}},[thinking]);
  useEffect(()=>{loadFromFirestore('chat_history').then(saved=>{setMsgs(saved??[{id:'1',sender:'aibram',text:`Hey ${userData.name}. What are we working on today?`}]);setLoaded(true);}).catch(()=>setLoaded(true));},[]);

  useEffect(()=>{
    if(loaded&&pendingMsg){
      // Check for idea context
      const ideaMatch=pendingMsg.match(/^\[IDEA_CONTEXT:(.+)\]$/);
      if(ideaMatch){
        setIdeaContext(ideaMatch[1]);
        send(`What do you think about this idea: "${ideaMatch[1]}"`,ideaMatch[1]);
      } else {
        send(pendingMsg);
      }
      clearPending();
    }
  },[loaded,pendingMsg]);

  useEffect(()=>{const s=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',()=>setKbVis(true));const h=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>setKbVis(false));return()=>{s.remove();h.remove();};},[]);

  const clearChat=()=>Alert.alert('Clear Chat?','Deletes all conversation history.',[{text:'Cancel',style:'cancel'},{text:'Clear',style:'destructive',onPress:async()=>{setIdeaContext(null);const r=[{id:Date.now().toString(),sender:'aibram',text:"Fresh start. What are we tackling?"}];setMsgs(r);await saveToFirestore('chat_history',r);}}]);

  const send=async(override: string|null=null,ideaCtx: string|null=null)=>{
    const txt=(override||input).trim();if(!txt)return;
    if(containsBadWord(txt)){
      const withU=[...msgs,{id:Date.now().toString(),sender:'user',text:txt},{id:(Date.now()+1).toString(),sender:'aibram',text:FILTER_RESPONSE}];
      setMsgs(withU);await saveToFirestore('chat_history',withU);setInput('');return;
    }
    addXp(10);setInput('');
    const snap=msgs,withU=[...snap,{id:Date.now().toString(),sender:'user',text:txt}];
    setMsgs(withU);await saveToFirestore('chat_history',withU);setThinking(true);
    const messages=buildMessages(userData.name,rank.name,xp,goals,snap,txt,profile,energy||'Steady',ideaCtx||ideaContext||undefined);
    const [result]=await Promise.all([callMistral(messages),new Promise(r=>setTimeout(r,500+Math.random()*700))]);
    if(result.action?.type==='add_task'&&result.action.task){const nt={id:Date.now().toString(),text:result.action.task,completed:false,date:today(),timeLabel:result.action.time??null,subtasks:[]};const ng=[...goals,nt];setGoals(ng);await saveToFirestore('goals',ng);if(nt.timeLabel)await scheduleTaskNotification(nt);}
    if(result.action?.type==='add_subtasks'&&result.action.parentTaskId&&result.action.subtasks){const updated=goals.map((g: any)=>{if(g.id!==result.action.parentTaskId)return g;const newSubs=result.action.subtasks.map((t: string,i: number)=>({id:`${g.id}-ai-${Date.now()}-${i}`,text:t,completed:false}));return{...g,subtasks:[...(g.subtasks||[]),...newSubs]};});setGoals(updated);await saveToFirestore('goals',updated);}
    if(result.action?.type==='focus'){setTimeout(()=>nav('Focus'),1000);}
    if(result.action?.type==='schedule'){setTimeout(()=>nav('Goals'),1000);}
    const final=[...withU,{id:(Date.now()+2).toString(),sender:'aibram',text:result.reply}];
    setMsgs(final);await saveToFirestore('chat_history',final);setThinking(false);
  };

  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
      <View style={{alignItems:'center',paddingTop:60,paddingBottom:10}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',width:'100%'}}>
          <PulsingOrb size={60} color={C.primary} isThinking={thinking}/>
          <TouchableOpacity onPress={clearChat} style={{position:'absolute',right:20,top:10,padding:10}}><Ionicons name="trash-outline" size={20} color={C.sub}/></TouchableOpacity>
        </View>
        <Text style={{color:thinking?C.thinking:C.primary,marginTop:5,fontFamily:'Inter_700Bold',fontSize:10}}>{thinking?'AIBRAM IS THINKING...':'AIBRAM ONLINE'}</Text>
        {energy&&<View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:4,backgroundColor:'rgba(255,255,255,0.05)',borderRadius:8,paddingHorizontal:10,paddingVertical:3}}><Text style={{fontSize:10,color:C.sub}}>{energy==='Recharging'?'🔋':energy==='Locked in'?'🔥':'⚡'}</Text><Text style={{fontSize:10,color:C.sub}}>{energy}</Text></View>}
      </View>

      <ScrollView style={{flex:1}} contentContainerStyle={{paddingHorizontal:20,paddingBottom:20}} ref={scrollRef} onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>
        {/* Thread context banner */}
        {ideaContext&&(
          <View style={{backgroundColor:'rgba(77,150,255,0.08)',borderWidth:1,borderColor:'rgba(77,150,255,0.2)',borderRadius:12,padding:10,marginBottom:4}}>
            <Text style={{fontSize:10,color:C.primary,marginBottom:4,letterSpacing:0.5}}>REPLYING TO YOUR IDEA</Text>
            <Text style={{fontSize:13,color:C.text,lineHeight:18}}>"{ideaContext}"</Text>
          </View>
        )}
        {ideaContext&&<View style={{width:2,height:12,backgroundColor:'rgba(77,150,255,0.4)',marginLeft:20,marginBottom:4,borderRadius:1}}/>}

        {msgs.map((m: any)=>(<View key={m.id} style={[S.bubble,m.sender==='user'?S.userBubble:S.aiBubble]}><Text style={{color:'#FFF'}}>{m.text}</Text></View>))}
        {thinking&&(<View style={[S.bubble,S.aiBubble,{paddingVertical:14}]}><Animated.Text style={{color:C.sub,opacity:dot.interpolate({inputRange:[0,1],outputRange:[0.3,1]})}}>Aibram is thinking...</Animated.Text></View>)}
      </ScrollView>

      <View style={[S.chatInput,{marginBottom:kbVis?10:90,backgroundColor:C.bg}]}>
        <TextInput style={S.chatBox} value={input} onChangeText={setInput} placeholder="Message Aibram..." placeholderTextColor={C.sub} editable={!thinking}/>
        <TouchableOpacity onPress={()=>send()} disabled={thinking}><Ionicons name="arrow-up-circle" size={40} color={thinking?C.sub:C.primary}/></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
const HomeScreen = ({ nav, userData, streak, xp, goals, setMsg, aibramNote, clearNote, weeklyReview, energy }: any) => {
  const rank=getRank(xp),next=getNextRank(xp),progress=Math.min(1,(xp-rank.minXp)/(next.minXp-rank.minXp));
  const todayT=goals.filter((g: any)=>g.date===today()),activeN=goals.filter((g: any)=>!g.completed).length;
  const isSunday=new Date().getDay()===0;
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.scrollPad}>
      <View style={{marginBottom:24}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
          <View>
            <Text style={{color:C.sub,fontSize:14,fontFamily:'Inter_400Regular'}}>Welcome back, {userData.name}</Text>
            <Text style={{color:'#FFF',fontSize:17,fontFamily:'Inter_900Black',marginTop:4}}>Lock in. Aibram's got your back.</Text>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            {energy&&<View style={{backgroundColor:'rgba(255,255,255,0.06)',borderRadius:8,paddingHorizontal:8,paddingVertical:4}}><Text style={{fontSize:11,color:energy==='Recharging'?C.low:energy==='Locked in'?C.warning:C.success}}>{energy==='Recharging'?'🔋':energy==='Locked in'?'🔥':'⚡'} {energy}</Text></View>}
            <View style={S.streakBadge}><Ionicons name="flame" size={16} color={C.warning}/><Text style={{color:C.warning,fontWeight:'bold',marginLeft:5}}>{streak}</Text></View>
          </View>
        </View>
        <View style={S.quoteCard}><Text style={{color:C.sub,fontSize:13,fontStyle:'italic',lineHeight:20}}>"{dailyQuote()}"</Text></View>
        {aibramNote&&(<View style={S.noteCard}><View style={{flex:1}}><Text style={{color:C.primary,fontSize:10,fontFamily:'Inter_700Bold',marginBottom:3}}>AIBRAM</Text><Text style={{color:C.text,fontSize:13}}>{aibramNote}</Text></View><TouchableOpacity onPress={clearNote} style={{padding:4}}><Ionicons name="close" size={16} color={C.sub}/></TouchableOpacity></View>)}
      </View>

      {isSunday&&weeklyReview&&(
        <View style={{backgroundColor:'rgba(127,90,240,0.08)',borderRadius:14,padding:16,marginBottom:20,borderWidth:1,borderColor:'rgba(127,90,240,0.25)'}}>
          <View style={{flexDirection:'row',alignItems:'center',marginBottom:10,gap:8}}><Ionicons name="bar-chart-outline" size={18} color={C.accent}/><Text style={{color:C.accent,fontFamily:'Inter_700Bold',fontSize:13}}>WEEKLY REVIEW</Text></View>
          <View style={{flexDirection:'row',gap:12,marginBottom:10}}>
            {[{label:'Completed',value:weeklyReview.completed},{label:'Total',value:weeklyReview.total},{label:'XP',value:weeklyReview.xpEarned}].map(item=>(<View key={item.label} style={{flex:1,alignItems:'center'}}><Text style={{color:'#FFF',fontFamily:'Inter_900Black',fontSize:20}}>{item.value}</Text><Text style={{color:C.sub,fontSize:11}}>{item.label}</Text></View>))}
          </View>
          {weeklyReview.observation&&<Text style={{color:C.text,fontSize:13,lineHeight:20,fontStyle:'italic'}}>"{weeklyReview.observation}"</Text>}
        </View>
      )}

      <Text style={S.secTitle}>Today's Mission</Text>
      <View style={S.missionCard}>
        {todayT.length===0?(<TouchableOpacity onPress={()=>nav('Goals')}><Text style={{color:C.sub,textAlign:'center'}}>No tasks yet — add one in Tasks →</Text></TouchableOpacity>):(
          <>{todayT.slice(0,3).map((g: any)=>(<View key={g.id} style={{flexDirection:'row',alignItems:'flex-start',marginBottom:10}}><Ionicons name={g.completed?'checkbox':'square-outline'} size={18} color={g.completed?C.success:C.warning} style={{marginTop:1}}/><View style={{flex:1,marginLeft:10}}><Text style={{color:C.text,fontSize:14,textDecorationLine:g.completed?'line-through':'none'}}>{g.text}</Text>{g.timeLabel&&<Text style={{color:C.primary,fontSize:11,marginTop:1}}>🕐 {g.timeLabel}</Text>}{g.subtasks?.length>0&&<Text style={{color:C.sub,fontSize:11,marginTop:1}}>{g.subtasks.filter((s: any)=>s.completed).length}/{g.subtasks.length} subtasks</Text>}</View></View>))}
          {todayT.length>3&&<TouchableOpacity onPress={()=>nav('Goals')} style={{marginTop:4}}><Text style={{color:C.primary,fontSize:12}}>+{todayT.length-3} more →</Text></TouchableOpacity>}</>
        )}
      </View>

      <Text style={S.secTitle}>Need help right now?</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:24}}>
        {QUICK_ACTIONS.map((a: any)=>(<TouchableOpacity key={a.label} style={S.quickBtn} onPress={()=>{Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);setMsg(a.label);nav('Aibram');}}><Ionicons name={a.icon} size={16} color={C.primary}/><Text style={{color:C.primary,fontSize:13,fontFamily:'Inter_700Bold'}}>{a.label}</Text></TouchableOpacity>))}
      </View>

      <View style={S.hangar}>
        <View style={{width:'100%',flexDirection:'row',justifyContent:'space-between',marginBottom:10}}><Text style={{color:C.gold,fontFamily:'Inter_900Black',fontSize:18,letterSpacing:1}}>{rank.name}</Text><Text style={{fontSize:10,color:C.primary,fontFamily:'Inter_700Bold'}}>{xp} / {next.minXp} XP</Text></View>
        <View style={{alignItems:'center',justifyContent:'center',height:150,width:220}}><AsteroidField tasks={goals}/><HologramShip tier={rank.tier}/></View>
        <View style={{width:'100%',marginTop:20}}><View style={{height:6,backgroundColor:'rgba(255,255,255,0.1)',borderRadius:3}}><View style={{height:6,backgroundColor:C.primary,borderRadius:3,width:`${progress*100}%`}}/></View></View>
      </View>

      <Text style={S.secTitle}>Command Deck</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'}}>
        {[{tab:'Aibram',icon:'chatbubbles',color:C.primary,label:'Aibram'},{tab:'Goals',icon:'calendar',color:C.success,label:`Tasks (${activeN})`},{tab:'Focus',icon:'infinite',color:C.thinking,label:'Focus'},{tab:'Space',icon:'planet',color:C.accent,label:'Space'}].map((item: any)=>(
          <TouchableOpacity key={item.tab} style={S.gridCard} onPress={()=>nav(item.tab)}>
            <Ionicons name={item.icon} size={28} color={item.color}/>
            <Text style={{color:'#FFF',marginTop:10,fontFamily:'Inter_700Bold'}}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

// ─── GOALS SCREEN ─────────────────────────────────────────────────────────────
const GoalsScreen = ({ goals, setGoals, addXp, profile }: any) => {
  const [calView,setCalView]=useState<'month'|'week'|'day'>('month');
  const [selDate,setSelDate]=useState(today()),[text,setText]=useState(''),[kbVis,setKbVis]=useState(false),[feedback,setFeedback]=useState(false),[showTP,setShowTP]=useState(false),[pendTime,setPendTime]=useState<any>(null),[editTask,setEditTask]=useState<any>(null),[expandedId,setExpandedId]=useState<string|null>(null),[subtaskInputs,setSubtaskInputs]=useState<Record<string,string>>({}),[showTemplates,setShowTemplates]=useState(false);
  useEffect(()=>{const s=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',()=>setKbVis(true));const h=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>setKbVis(false));return()=>{s.remove();h.remove();};},[]);
  const saveGoals=async(updated: any[])=>{setGoals(updated);await saveToFirestore('goals',updated);};
  const toggle=async(id: string)=>{Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);const g=goals.find((g: any)=>g.id===id);if(g&&!g.completed){addXp(50);Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);setFeedback(true);setTimeout(()=>setFeedback(false),2200);}await saveGoals(goals.map((g: any)=>g.id===id?{...g,completed:!g.completed}:g));};
  const toggleSubtask=async(taskId: string,subId: string)=>{Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);const updated=goals.map((g: any)=>{if(g.id!==taskId)return g;const newSubs=g.subtasks.map((s: any)=>s.id===subId?{...s,completed:!s.completed}:s);return{...g,subtasks:newSubs,completed:newSubs.every((s: any)=>s.completed)};});await saveGoals(updated);};
  const addSubtask=async(taskId: string)=>{const txt=(subtaskInputs[taskId]||'').trim();if(!txt)return;await saveGoals(goals.map((g: any)=>g.id!==taskId?g:{...g,subtasks:[...(g.subtasks||[]),{id:`${taskId}-${Date.now()}`,text:txt,completed:false}]}));setSubtaskInputs(p=>({...p,[taskId]:''}));};
  const deleteTask=(id: string)=>Alert.alert('Delete task?',"This can't be undone.",[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>saveGoals(goals.filter((g: any)=>g.id!==id))}]);
  const saveEdit=async(updated: any)=>{await saveGoals(goals.map((g: any)=>g.id===updated.id?updated:g));setEditTask(null);};
  const addGoal=async(dateOverride?: string)=>{if(!text.trim())return;const ng={id:Date.now().toString(),text:text.trim(),completed:false,date:dateOverride||selDate,timeLabel:pendTime?.label??null,subtasks:[]};await saveGoals([...goals,ng]);if(ng.timeLabel)await scheduleTaskNotification(ng);setText('');setPendTime(null);Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);Keyboard.dismiss();};
  const handleAddTemplates=async(tasks: any[])=>{const newGoals=[...goals,...tasks];await saveGoals(newGoals);Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);};
  const filtered=goals.filter((g: any)=>g.date===selDate);
  const renderTaskRow=(g: any)=>{
    const expanded=expandedId===g.id,subs=g.subtasks||[],subDone=subs.filter((s: any)=>s.completed).length;
    return(
      <View key={g.id} style={{marginBottom:10}}>
        <View style={[S.taskRow,g.completed&&{opacity:0.5},{marginBottom:0,borderBottomLeftRadius:expanded?0:8,borderBottomRightRadius:expanded?0:8}]}>
          {subs.length>0?(<TouchableOpacity onPress={()=>{Haptics.selectionAsync();setExpandedId(expanded?null:g.id);}} hitSlop={{top:10,bottom:10,left:10,right:10}}><Ionicons name={expanded?'chevron-down':'chevron-forward'} size={20} color={C.sub}/></TouchableOpacity>):(<TouchableOpacity onPress={()=>toggle(g.id)}><Ionicons name={g.completed?'checkbox':'square-outline'} size={24} color={g.completed?C.success:C.warning}/></TouchableOpacity>)}
          <TouchableOpacity style={{flex:1,marginLeft:10}} onPress={()=>{if(subs.length===0)toggle(g.id);}} activeOpacity={subs.length>0?1:0.6}>
            <Text style={[{color:'#FFF'},g.completed&&{textDecorationLine:'line-through',color:C.sub}]}>{g.text}</Text>
            {g.timeLabel&&<Text style={{color:C.primary,fontSize:11,marginTop:2}}>🕐 {g.timeLabel}</Text>}
            {subs.length>0&&<Text style={{color:C.sub,fontSize:11,marginTop:2}}>{subDone}/{subs.length} done</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setEditTask(g)} style={{padding:8}} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="pencil-outline" size={16} color={C.sub}/></TouchableOpacity>
          <TouchableOpacity onPress={()=>deleteTask(g.id)} style={{padding:8}} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="trash-outline" size={16} color={C.sub}/></TouchableOpacity>
        </View>
        {expanded&&(<View style={{backgroundColor:'rgba(255,255,255,0.03)',borderBottomLeftRadius:8,borderBottomRightRadius:8,borderWidth:1,borderTopWidth:0,borderColor:'rgba(255,255,255,0.05)',paddingHorizontal:14,paddingBottom:10}}>
          {subs.map((sub: any)=>(<TouchableOpacity key={sub.id} onPress={()=>toggleSubtask(g.id,sub.id)} style={{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.04)'}}><Ionicons name={sub.completed?'checkmark-circle':'ellipse-outline'} size={18} color={sub.completed?C.success:C.sub}/><Text style={{marginLeft:10,color:sub.completed?C.sub:'#FFF',fontSize:14,textDecorationLine:sub.completed?'line-through':'none',flex:1}}>{sub.text}</Text></TouchableOpacity>))}
          <View style={{flexDirection:'row',alignItems:'center',marginTop:8}}><TextInput style={{flex:1,color:'#FFF',fontSize:13,paddingVertical:6,borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.15)'}} placeholder="Add subtask..." placeholderTextColor={C.sub} value={subtaskInputs[g.id]||''} onChangeText={t=>setSubtaskInputs(p=>({...p,[g.id]:t}))} returnKeyType="done" onSubmitEditing={()=>addSubtask(g.id)}/><TouchableOpacity onPress={()=>addSubtask(g.id)} style={{padding:6}}><Ionicons name="add-circle" size={24} color={C.primary}/></TouchableOpacity></View>
        </View>)}
      </View>
    );
  };
  return(
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
      <View style={[S.pageHead,{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'}]}>
        <View><Text style={S.pageTitle}>Tasks</Text><Text style={{color:C.sub,fontSize:12,marginTop:2}}>{selDate}</Text></View>
        <TouchableOpacity onPress={()=>setShowTemplates(true)} style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:8,backgroundColor:'rgba(77,150,255,0.1)',borderRadius:10,borderWidth:1,borderColor:'rgba(77,150,255,0.2)'}}>
          <Ionicons name="copy-outline" size={15} color={C.primary}/>
          <Text style={{color:C.primary,fontFamily:'Inter_700Bold',fontSize:13}}>Templates</Text>
        </TouchableOpacity>
      </View>
      <View style={{flexDirection:'row',marginHorizontal:20,marginBottom:12,backgroundColor:'rgba(255,255,255,0.05)',borderRadius:10,padding:3}}>
        {(['month','week','day'] as const).map(v=>(
          <TouchableOpacity key={v} onPress={()=>setCalView(v)} style={{flex:1,paddingVertical:7,alignItems:'center',borderRadius:8,backgroundColor:calView===v?C.primary:'transparent'}}>
            <Text style={{color:calView===v?'#050B14':C.sub,fontFamily:'Inter_700Bold',fontSize:13,textTransform:'capitalize'}}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{paddingBottom:160}} keyboardShouldPersistTaps="handled">
        {calView==='month'&&<MonthView selectedDate={selDate} setSelectedDate={setSelDate} goals={goals}/>}
        {calView==='week'&&<WeekView goals={goals} onToggleTask={toggle} onDeleteTask={deleteTask} onAddTask={(date: string)=>{setSelDate(date);setCalView('month');}}/>}
        {calView==='day'&&<DayView selectedDate={selDate} goals={goals} onToggleTask={toggle} onDeleteTask={deleteTask}/>}
        {calView==='month'&&(
          <View style={{paddingHorizontal:20}}>
            {feedback&&<Text style={{color:C.success,textAlign:'center',marginBottom:12,fontFamily:'Inter_700Bold',fontSize:14}}>That's progress. 🔥</Text>}
            {filtered.length===0?<Text style={{color:C.sub,textAlign:'center',marginTop:30,opacity:0.6}}>Add your first task below ↓</Text>:filtered.map(renderTaskRow)}
            {filtered.length>0&&<Text style={{color:C.sub,fontSize:11,textAlign:'center',marginTop:8,opacity:0.5}}>Tap chevron to expand subtasks</Text>}
          </View>
        )}
      </ScrollView>
      <View style={[S.inputRow,{marginHorizontal:20,backgroundColor:C.bg,marginBottom:kbVis?10:90}]}>
        <TextInput style={S.taskInput} value={text} onChangeText={setText} placeholder={`Add a task for ${selDate}...`} placeholderTextColor={C.sub}/>
        <TouchableOpacity onPress={()=>setShowTP(true)} style={{padding:6,marginRight:2}}><Ionicons name="time-outline" size={24} color={pendTime?C.primary:C.sub}/></TouchableOpacity>
        <TouchableOpacity onPress={()=>addGoal()}><Ionicons name="add-circle" size={40} color={C.primary}/></TouchableOpacity>
      </View>
      {pendTime&&(<View style={{position:'absolute',bottom:kbVis?62:152,left:32,flexDirection:'row',alignItems:'center',gap:6}}><Text style={{color:C.primary,fontSize:12}}>🕐 {pendTime.label}</Text><TouchableOpacity onPress={()=>setPendTime(null)}><Ionicons name="close-circle" size={14} color={C.sub}/></TouchableOpacity></View>)}
      <TimePicker visible={showTP} onConfirm={(t: any)=>{setPendTime(t);setShowTP(false);}} onCancel={()=>setShowTP(false)} initial={pendTime}/>
      <TaskEditModal visible={!!editTask} task={editTask} onSave={saveEdit} onCancel={()=>setEditTask(null)}/>
      <TemplatesModal visible={showTemplates} onClose={()=>setShowTemplates(false)} onAddTasks={handleAddTemplates} profile={profile}/>
    </KeyboardAvoidingView>
  );
};

// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
const ProfileScreen = ({ userData, xp, streak, profile, onProfileUpdate, onSignOut, onDeleteAccount, logs, setLogs, addXp }: any) => {
  const rank=getRank(xp),next=getNextRank(xp),progress=Math.min(1,(xp-rank.minXp)/(next.minXp-rank.minXp));
  const [editMode,setEditMode]=useState(false),[localProfile,setLocalProfile]=useState(profile||{}),[saving,setSaving]=useState(false),[log,setLog]=useState(''),[editId,setEditId]=useState<string|null>(null),[note,setNote]=useState<string|null>(null),[kbVis,setKbVis]=useState(false);
  useEffect(()=>{const s=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',()=>setKbVis(true));const h=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>setKbVis(false));return()=>{s.remove();h.remove();};},[]);
  const ageGroup=getAgeGroup(localProfile.age||17),sugg=SUGGESTIONS[ageGroup]||SUGGESTIONS.student;
  const toggleGoal=(key: string,val: string)=>{const cur=localProfile[key]||[];setLocalProfile((p: any)=>({...p,[key]:cur.includes(val)?cur.filter((x: string)=>x!==val):[...cur,val]}));};
  const saveProfile=async()=>{setSaving(true);await setDoc(doc(db,'users',uid()),localProfile,{merge:true});onProfileUpdate(localProfile);setSaving(false);setEditMode(false);};
  const saveLog=async()=>{if(!log.trim())return;let updated;if(editId){updated=logs.map((e: any)=>e.id===editId?{...e,text:log.trim()}:e);setEditId(null);}else{addXp(20);const n=rand(LOG_NOTES);setNote(n);setTimeout(()=>setNote(null),4000);updated=[{id:Date.now().toString(),date:new Date().toLocaleDateString(),text:log.trim()},...logs];}setLogs(updated);await saveToFirestore('logs',updated);setLog('');Keyboard.dismiss();};
  const delLog=(id: string)=>Alert.alert("Delete entry?","This can't be undone.",[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{const u=logs.filter((e: any)=>e.id!==id);setLogs(u);await saveToFirestore('logs',u);if(editId===id){setLog('');setEditId(null);}}}]);
  const handleDeleteAccount=()=>Alert.alert('Delete Account','This permanently deletes your account and ALL your data.',[{text:'Cancel',style:'cancel'},{text:'Delete Forever',style:'destructive',onPress:()=>Alert.alert('Are you absolutely sure?','Your goals, tasks, logs, XP, and streak will be gone forever.',[{text:'Cancel',style:'cancel'},{text:'Yes, delete everything',style:'destructive',onPress:onDeleteAccount}])}]);
  return(
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView contentContainerStyle={[S.scrollPad,{paddingBottom:kbVis?20:120}]}>
        <View style={{marginBottom:24}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <View><Text style={{color:C.sub,fontSize:13}}>{userData.name}</Text><Text style={{color:C.gold,fontFamily:'Inter_900Black',fontSize:22}}>{rank.name}</Text></View>
            <TouchableOpacity onPress={onSignOut} style={{flexDirection:'row',alignItems:'center',gap:6,padding:8,backgroundColor:'rgba(239,69,101,0.1)',borderRadius:10,borderWidth:1,borderColor:'rgba(239,69,101,0.2)'}}><Ionicons name="log-out-outline" size={16} color={C.danger}/><Text style={{color:C.danger,fontFamily:'Inter_700Bold',fontSize:13}}>Sign Out</Text></TouchableOpacity>
          </View>
          <View style={{flexDirection:'row',gap:12,marginBottom:16}}>
            {[{label:'XP',value:xp,icon:'star',color:C.primary},{label:'Streak',value:streak,icon:'flame',color:C.warning}].map(item=>(<View key={item.label} style={{flex:1,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:14,padding:16,alignItems:'center',borderWidth:1,borderColor:C.line}}><Ionicons name={item.icon as any} size={20} color={item.color}/><Text style={{color:'#FFF',fontFamily:'Inter_900Black',fontSize:22,marginTop:6}}>{item.value}</Text><Text style={{color:C.sub,fontSize:11}}>{item.label}</Text></View>))}
          </View>
          <View style={{height:6,backgroundColor:'rgba(255,255,255,0.1)',borderRadius:3}}><View style={{height:6,backgroundColor:C.primary,borderRadius:3,width:`${progress*100}%`}}/></View>
          <Text style={{color:C.sub,fontSize:11,marginTop:4}}>{xp} / {next.minXp} XP to {next.name}</Text>
        </View>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <Text style={S.secTitle}>My Goals</Text>
          <TouchableOpacity onPress={()=>editMode?saveProfile():setEditMode(true)} style={{paddingHorizontal:16,paddingVertical:8,backgroundColor:editMode?C.success:'rgba(77,150,255,0.1)',borderRadius:10,borderWidth:1,borderColor:editMode?C.success:'rgba(77,150,255,0.3)'}}>
            {saving?<ActivityIndicator size="small" color="#FFF"/>:<Text style={{color:editMode?'#FFF':C.primary,fontFamily:'Inter_700Bold',fontSize:13}}>{editMode?'Save':'Edit'}</Text>}
          </TouchableOpacity>
        </View>
        {editMode?(
          <View>
            {[{label:'SHORT-TERM',key:'shortTermGoals',chips:sugg.short},{label:'MID-TERM',key:'midTermGoals',chips:sugg.mid},{label:'LONG-TERM',key:'longTermGoals',chips:sugg.long}].map(section=>(<View key={section.key} style={{marginBottom:20}}><Text style={[S.sectionLabel,{marginBottom:10}]}>{section.label}</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{section.chips.map((s: string)=><Chip key={s} label={s} selected={(localProfile[section.key]||[]).includes(s)} onPress={()=>toggleGoal(section.key,s)}/>)}</View></View>))}
            <Text style={[S.sectionLabel,{marginBottom:10}]}>INTERESTS</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:20}}>{INTERESTS.map(s=><Chip key={s} label={s} selected={(localProfile.interests||[]).includes(s)} onPress={()=>toggleGoal('interests',s)}/>)}</View>
            <Text style={[S.sectionLabel,{marginBottom:10}]}>BIGGEST STRUGGLE</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:8}}>{sugg.struggles.map((s: string)=><Chip key={s} label={s} selected={localProfile.struggle===s} onPress={()=>setLocalProfile((p: any)=>({...p,struggle:s}))}/>)}</View>
          </View>
        ):(
          <View style={{backgroundColor:'rgba(255,255,255,0.03)',borderRadius:14,padding:16,borderWidth:1,borderColor:C.line,marginBottom:24}}>
            {[{label:'Short-term',key:'shortTermGoals'},{label:'Mid-term',key:'midTermGoals'},{label:'Long-term',key:'longTermGoals'}].map(s=>(<View key={s.key} style={{marginBottom:12}}><Text style={{color:C.sub,fontSize:11,fontFamily:'Inter_700Bold',marginBottom:6}}>{s.label.toUpperCase()}</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{((localProfile[s.key]||[]) as string[]).length===0?<Text style={{color:C.sub,fontSize:13,opacity:0.5}}>None set</Text>:((localProfile[s.key]||[]) as string[]).map((g: string)=>(<View key={g} style={{backgroundColor:'rgba(77,150,255,0.1)',paddingHorizontal:10,paddingVertical:4,borderRadius:12,margin:3}}><Text style={{color:C.primary,fontSize:12}}>{g}</Text></View>))}</View></View>))}
            {localProfile.struggle&&<View style={{marginTop:4}}><Text style={{color:C.sub,fontSize:11,fontFamily:'Inter_700Bold',marginBottom:4}}>STRUGGLE</Text><Text style={{color:C.text,fontSize:13}}>{localProfile.struggle}</Text></View>}
          </View>
        )}
        <Text style={[S.secTitle,{marginTop:8}]}>Logs</Text>
        <TextInput style={S.logInput} multiline placeholder="Write about your day..." placeholderTextColor={C.sub} value={log} onChangeText={setLog}/>
        <View style={{flexDirection:'row',gap:10}}>
          <TouchableOpacity style={[S.primaryBtn,{flex:1,marginBottom:0}]} onPress={saveLog}><Text style={S.btnTxt}>{editId?'Update Entry':'Save Entry'}</Text></TouchableOpacity>
          {editId&&<TouchableOpacity style={[S.primaryBtn,{flex:0.4,backgroundColor:'rgba(255,255,255,0.1)',marginBottom:0}]} onPress={()=>{setLog('');setEditId(null);}}><Text style={[S.btnTxt,{color:C.sub}]}>Cancel</Text></TouchableOpacity>}
        </View>
        {note&&(<View style={[S.noteCard,{marginTop:14}]}><View style={{flex:1}}><Text style={{color:C.primary,fontSize:10,fontFamily:'Inter_700Bold',marginBottom:3}}>AIBRAM</Text><Text style={{color:C.text,fontSize:13}}>{note}</Text></View><TouchableOpacity onPress={()=>setNote(null)} style={{padding:4}}><Ionicons name="close" size={16} color={C.sub}/></TouchableOpacity></View>)}
        {logs.length===0&&<Text style={{color:C.sub,textAlign:'center',marginTop:24,opacity:0.6}}>No entries yet. Start writing — it compounds.</Text>}
        {logs.map((e: any)=>(<View key={e.id} style={[S.logCard,{marginTop:12},editId===e.id&&{borderLeftColor:C.primary}]}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><Text style={{color:C.sub,fontSize:10}}>{e.date}</Text><View style={{flexDirection:'row',gap:14}}><TouchableOpacity onPress={()=>{setLog(e.text);setEditId(e.id);Haptics.selectionAsync();}} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="pencil-outline" size={15} color={C.sub}/></TouchableOpacity><TouchableOpacity onPress={()=>delLog(e.id)} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="trash-outline" size={15} color={C.danger}/></TouchableOpacity></View></View><Text style={{color:'#FFF'}}>{e.text}</Text></View>))}
        <View style={{marginTop:40,paddingTop:24,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.06)'}}>
          <TouchableOpacity onPress={handleDeleteAccount} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,padding:14,borderRadius:12,borderWidth:1,borderColor:'rgba(239,69,101,0.3)',backgroundColor:'rgba(239,69,101,0.05)'}}><Ionicons name="trash-outline" size={16} color={C.danger}/><Text style={{color:C.danger,fontFamily:'Inter_700Bold',fontSize:14}}>Delete Account</Text></TouchableOpacity>
          <Text style={{color:C.sub,fontSize:11,textAlign:'center',marginTop:8,opacity:0.6}}>Permanently deletes your account and all data.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function MainApp() {
  const router=useRouter();
  const [loading,setLoading]=useState(true),[onboarded,setOnboarded]=useState(false),[step,setStep]=useState(0),[name,setName]=useState(''),[profile,setProfile]=useState<any>(null);
  const [tab,setTab]=useState('Home'),[streak,setStreak]=useState(0),[xp,setXp]=useState(0);
  const [showBriefing,setShowBriefing]=useState(false),[briefingData,setBriefingData]=useState<any>(null);
  const [energy,setEnergy]=useState<string>('Steady');
  const [goals,setGoals]=useState<any[]>([]),[logs,setLogs]=useState<any[]>([]),[pending,setPending]=useState<string|null>(null),[aibramNote,setAibramNote]=useState<string|null>(null),[userData,setUserData]=useState({name:''});
  const [weeklyReview,setWeeklyReview]=useState<any>(null);

  let [fontsLoaded]=useFonts({Inter_400Regular,Inter_700Bold,Inter_900Black});
  useEffect(()=>{boot();},[]);

  const boot=async()=>{
    try{
      const user=auth.currentUser;if(!user){router.replace('/login');return;}
      const snap=await getDoc(doc(db,'users',user.uid));
      if(snap.exists()){
        const p=snap.data();
        setUserData({name:p.name||user.displayName||'Captain'});
        setXp(p.xp||0);setOnboarded(p.onboarded===true);setProfile(p);
        const last=p.lastCheckin,saved=p.streak||0;
        if(!last||(last!==today()&&last!==yesterday()))setStreak(0);else setStreak(saved);
        if(p.energyDate===today()&&p.energyToday)setEnergy(p.energyToday);
      }
      const [sg,sn,sl,swr]=await Promise.all([loadFromFirestore('goals'),loadFromFirestore('aibram_note'),loadFromFirestore('logs'),loadFromFirestore('weekly_review')]);
      if(sg)setGoals(sg);if(sn)setAibramNote(sn);if(sl)setLogs(sl);

      if(new Date().getDay()===0){
        if(swr&&swr.date===today()){setWeeklyReview(swr);}
        else{
          const allGoals=sg||[];const weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);
          const weekGoals=allGoals.filter((g: any)=>{const d=new Date(g.date);return d>=weekStart&&d<=new Date();});
          const completed=weekGoals.filter((g: any)=>g.completed).length,total=weekGoals.length;
          const snapData=snap.exists()?snap.data():{};
          const obs=await generateWeeklyReview(snapData.name||'there',completed,total,snapData.xp||0,snapData.streak||0,snapData);
          const review={date:today(),completed,total,xpEarned:snapData.xp||0,streak:snapData.streak||0,observation:obs};
          setWeeklyReview(review);await saveToFirestore('weekly_review',review);
        }
      }

      if(snap.exists()&&snap.data().onboarded){
        const lastBriefing=snap.data().lastBriefingDate;
        if(lastBriefing!==today()){
          const todayGoals=(sg||[]).filter((g: any)=>g.date===today());
          const yesterdayGoals=(sg||[]).filter((g: any)=>g.date===yesterday()&&g.completed);
          setBriefingData({todayTasks:todayGoals,yesterdayCompleted:yesterdayGoals.length,streak:snap.data().streak||0,name:snap.data().name||'Captain'});
          setShowBriefing(true);
        }
      }

      const{status}=await Notifications.getPermissionsAsync();
      if(status==='granted')await scheduleStreakReminder();
    }catch(e){console.error(e);}
    setLoading(false);
  };

  const addXp=async(n: number)=>setXp(prev=>{const nx=prev+n;updateDoc(doc(db,'users',uid()),{xp:nx}).catch(console.error);return nx;});

  const dismissBriefing=async(selectedEnergy: string)=>{
    setShowBriefing(false);setEnergy(selectedEnergy);
    try{
      await updateDoc(doc(db,'users',uid()),{lastBriefingDate:today(),lastCheckin:today(),energyToday:selectedEnergy,energyDate:today()});
      const snap=await getDoc(doc(db,'users',uid()));
      const p=snap.exists()?snap.data():{};
      const last=p.lastCheckin,current=p.streak||0;
      let ns=1;if(last===today())ns=current;else if(last===yesterday())ns=current+1;
      setStreak(ns);addXp(10);
      await updateDoc(doc(db,'users',uid()),{streak:ns});
    }catch(e){console.error(e);}
  };

  const handleSignOut=()=>Alert.alert('Sign Out','Are you sure?',[{text:'Cancel',style:'cancel'},{text:'Sign Out',style:'destructive',onPress:async()=>{await signOutUser();router.replace('/login');}}]);
  const handleDeleteAccount=async()=>{try{await deleteAccount();router.replace('/login');}catch(e: any){if(e.code==='auth/requires-recent-login'){Alert.alert('Re-authentication required','Please sign out and sign back in before deleting your account.');}else{Alert.alert('Error','Could not delete account. Please try again.');}}};
  const handleLogSaved=async(note: string)=>{setAibramNote(note);await saveToFirestore('aibram_note',note);};
  const clearNote=async()=>{setAibramNote(null);await saveToFirestore('aibram_note',null);};

  const handleProfileComplete=async(collectedProfile: any)=>{
    try{if(uid())await setDoc(doc(db,'users',uid()),{...collectedProfile,name,onboarded:false},{merge:true});setProfile({...collectedProfile,name});setUserData({name});}catch(e){console.error(e);}
    setStep(4);
  };
  const handleGreetingDone=async()=>{setOnboarded(false);setStep(5);};
  const handleTaskSuggestionsDone=async(suggestedTasks: any[])=>{if(suggestedTasks.length>0){const ng=[...goals,...suggestedTasks];setGoals(ng);await saveToFirestore('goals',ng);}setStep(6);};
  const handleNotificationAllow=async()=>{await requestNotificationPermission();finishOnboarding();};
  const handleNotificationSkip=()=>finishOnboarding();
  const finishOnboarding=async()=>{setOnboarded(true);setUserData({name});setProfile((prev: any)=>({...prev,onboarded:true}));try{await setDoc(doc(db,'users',uid()),{onboarded:true,lastBriefingDate:today()},{merge:true});}catch(e){console.error(e);}};

  if(!fontsLoaded||loading)return(<View style={{flex:1,backgroundColor:C.bg,justifyContent:'center',alignItems:'center'}}><ActivityIndicator color={C.primary}/></View>);

  if(!onboarded){
    if(step===0)return<OnboardScreen0 onNext={()=>setStep(1)}/>;
    if(step===1)return<OnboardScreen1 onNext={()=>setStep(2)}/>;
    if(step===2)return<OnboardScreen2 name={name} setName={setName} onNext={()=>setStep(3)}/>;
    if(step===3)return<OnboardScreen3 name={name} onComplete={handleProfileComplete}/>;
    if(step===4)return<OnboardScreen4 name={name} profile={profile} onDone={handleGreetingDone}/>;
    if(step===5)return<OnboardScreen5 name={name} profile={profile} onComplete={handleTaskSuggestionsDone}/>;
    if(step===6)return<OnboardScreen6 onAllow={handleNotificationAllow} onSkip={handleNotificationSkip}/>;
  }

  if(showBriefing&&briefingData){
    return<DailyBriefingScreen name={briefingData.name} profile={profile} todayTasks={briefingData.todayTasks} streak={briefingData.streak} yesterdayCompleted={briefingData.yesterdayCompleted} onDone={dismissBriefing} onGoToTasks={(e: string)=>{dismissBriefing(e);setTab('Goals');}}/>;
  }

  return(
    <LinearGradient colors={['#050B14','#0F172A','#1E293B']} style={{flex:1}}>
      <StatusBar barStyle="light-content"/>
      <View style={{flex:1}}>
        {tab==='Home'    &&<HomeScreen nav={setTab} userData={userData} streak={streak} xp={xp} goals={goals} setMsg={setPending} aibramNote={aibramNote} clearNote={clearNote} weeklyReview={weeklyReview} energy={energy}/>}
        {tab==='Goals'   &&<GoalsScreen goals={goals} setGoals={setGoals} addXp={addXp} profile={profile}/>}
        {tab==='Aibram'  &&<AibramScreen userData={userData} addXp={addXp} pendingMsg={pending} clearPending={()=>setPending(null)} goals={goals} setGoals={setGoals} xp={xp} nav={setTab} profile={profile} energy={energy}/>}
        {tab==='Focus'   &&<FocusScreen addXp={addXp} setMsg={setPending} nav={setTab} goals={goals}/>}
        {tab==='Space'   &&<SpaceScreen goals={goals} setGoals={setGoals} profile={profile} setPendingMsg={setPending} setTab={setTab}/>}
        {tab==='Profile' &&<ProfileScreen userData={userData} xp={xp} streak={streak} profile={profile} onProfileUpdate={(p: any)=>setProfile(p)} onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} logs={logs} setLogs={setLogs} addXp={addXp}/>}
      </View>
      <View style={S.navBar}>
        {[{t:'Home',icon:'planet'},{t:'Goals',icon:'calendar'},{t:'Aibram',icon:'chatbubbles'},{t:'Focus',icon:'infinite'},{t:'Space',icon:'telescope-outline'}].map(({t,icon})=>(
          <TouchableOpacity key={t} onPress={()=>{Haptics.selectionAsync();setTab(t);}} style={{alignItems:'center'}}>
            <Ionicons name={icon as any} size={24} color={tab===t?C.primary:C.sub}/>
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S=StyleSheet.create({
  screen:{flex:1},scrollPad:{padding:20,paddingTop:60,paddingBottom:120},pageHead:{paddingTop:60,paddingHorizontal:20,paddingBottom:10},pageTitle:{fontSize:28,fontFamily:'Inter_700Bold',color:'#FFF'},secTitle:{fontSize:18,fontFamily:'Inter_700Bold',color:'#FFF',marginBottom:12},sectionLabel:{fontSize:11,fontFamily:'Inter_700Bold',color:'#94A3B8',letterSpacing:1.5,marginBottom:4},
  calBox:{marginHorizontal:20,backgroundColor:'rgba(255,255,255,0.03)',borderRadius:16,padding:15,marginBottom:20,borderWidth:1,borderColor:'rgba(255,255,255,0.05)'},calHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:15},calTitle:{color:'#FFF',fontFamily:'Inter_700Bold',letterSpacing:2},calGrid:{flexDirection:'row',flexWrap:'wrap'},calLabel:{width:'14.28%',textAlign:'center',color:'#94A3B8',fontSize:10,marginBottom:10},calCell:{width:'14.28%',height:44,justifyContent:'center',alignItems:'center',marginBottom:5,borderRadius:8},calSel:{backgroundColor:'#4D96FF'},calTod:{borderWidth:1,borderColor:'#FF8906'},calNum:{color:'#E2E8F0',fontSize:14},dot:{width:4,height:4,borderRadius:2,marginTop:4},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.8)',justifyContent:'center',alignItems:'center',padding:20},modalBox:{width:'100%',backgroundColor:'#1E293B',borderRadius:20,padding:25,borderWidth:1,borderColor:'#4D96FF'},modalTitle:{fontSize:22,color:'#FFF',fontFamily:'Inter_900Black',marginBottom:5},
  primaryBtn:{backgroundColor:'#4D96FF',padding:15,borderRadius:12,alignItems:'center',marginBottom:16},btnTxt:{fontWeight:'bold',fontFamily:'Inter_700Bold',color:'#050B14',fontSize:15},
  quoteCard:{marginTop:16,padding:14,backgroundColor:'rgba(77,150,255,0.07)',borderRadius:12,borderLeftWidth:3,borderLeftColor:'#4D96FF'},noteCard:{marginTop:12,padding:14,backgroundColor:'rgba(77,150,255,0.06)',borderRadius:12,borderLeftWidth:3,borderLeftColor:'#4D96FF',flexDirection:'row',alignItems:'flex-start'},statusCard:{marginTop:12,padding:14,backgroundColor:'rgba(255,255,255,0.05)',borderRadius:12,borderLeftWidth:4},missionCard:{backgroundColor:'rgba(255,255,255,0.04)',borderRadius:14,padding:16,marginBottom:24,borderWidth:1,borderColor:'rgba(255,255,255,0.05)'},streakBadge:{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,137,6,0.1)',paddingHorizontal:8,paddingVertical:4,borderRadius:8,borderWidth:1,borderColor:'#FF8906'},quickBtn:{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(77,150,255,0.1)',paddingHorizontal:14,paddingVertical:10,borderRadius:20,borderWidth:1,borderColor:'rgba(77,150,255,0.3)',gap:6},
  hangar:{alignItems:'center',backgroundColor:'rgba(16,22,38,0.7)',borderRadius:16,padding:20,borderWidth:1,borderColor:'rgba(255,255,255,0.05)',marginBottom:20,overflow:'hidden'},hangarShipWrap:{height:150,width:220,justifyContent:'center',alignItems:'center',zIndex:10},hangarDish:{width:140,height:40,borderRadius:100,backgroundColor:'rgba(77,150,255,0.2)',position:'absolute',bottom:-10,transform:[{rotateX:'70deg'}]},
  gridCard:{width:'48%',backgroundColor:'rgba(255,255,255,0.05)',borderRadius:16,padding:15,marginBottom:15,alignItems:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.05)'},
  inputRow:{flexDirection:'row',alignItems:'center',padding:10},taskInput:{flex:1,backgroundColor:'rgba(255,255,255,0.1)',borderRadius:8,padding:10,color:'#FFF',marginRight:6},taskRow:{flexDirection:'row',alignItems:'center',padding:15,backgroundColor:'rgba(255,255,255,0.05)',borderRadius:8},goalInput:{backgroundColor:'rgba(255,255,255,0.08)',borderRadius:10,color:'#FFF',fontSize:15,paddingHorizontal:14,paddingVertical:12},
  customRow:{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.04)',borderRadius:10,paddingLeft:12,borderWidth:1,borderColor:'rgba(255,255,255,0.08)',marginBottom:4},customInput:{flex:1,color:'#FFF',fontSize:14,paddingVertical:10,fontFamily:'Inter_400Regular'},
  bubble:{padding:12,borderRadius:12,marginBottom:8,maxWidth:'82%'},userBubble:{backgroundColor:'#4D96FF',alignSelf:'flex-end'},aiBubble:{backgroundColor:'rgba(255,255,255,0.1)',alignSelf:'flex-start'},chatInput:{flexDirection:'row',alignItems:'center',padding:10},chatBox:{flex:1,backgroundColor:'rgba(255,255,255,0.1)',borderRadius:20,padding:10,color:'#FFF',marginRight:10},
  logInput:{backgroundColor:'rgba(255,255,255,0.05)',color:'#FFF',borderRadius:12,padding:15,minHeight:100,textAlignVertical:'top',marginBottom:15},logCard:{backgroundColor:'rgba(255,255,255,0.05)',padding:15,borderRadius:12,marginBottom:10,borderLeftWidth:3,borderLeftColor:'#7F5AF0'},
  navBar:{flexDirection:'row',justifyContent:'space-around',paddingTop:15,paddingBottom:40,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.1)',backgroundColor:'#050B14',position:'absolute',bottom:0,width:'100%'},
});