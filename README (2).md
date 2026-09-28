# Aibram

Aibram is my space themed AI Life OS app. It turns your day (tasks, events, notes, thoughts) into a living constellation, with a real Claude powered AI assistant that can see your schedule, take actions for you, and help you plan around real world context like traffic and news.

Built by me ([Joshua](https://github.com/JoshuaT6186)) under my company, Eternity Works, and submitted to [RevenueCat Shipaton 2026](https://www.shipaton.com/).

---

## What it does

- **AI assistant with real tool use.** Aibram doesn't just chat, it proposes actions (adding a task, scheduling an event, creating a Space node) and asks you to approve or decline each one before anything actually happens.
- **Space.** A visual, constellation style map of your notes and ideas instead of a flat list.
- **Deep Memory.** Aibram remembers durable facts about you across conversations, separate from your rolling chat history.
- **Morning Brief.** A personalized briefing three times a day (morning, afternoon, evening) that combines your schedule, local news, and a quote of the day.
- **Real ETA and traffic aware planning.** Calendar events with a location get real "leave by" times powered by live traffic data instead of simulated ones.
- **Deep Focus and Mindfulness.** Structured focus sessions with timers, task intent, and ambient sound.
- **Document Intelligence.** Upload documents (like a syllabus) and have Aibram extract and act on the content.
- **Aibram+.** A subscription tier that unlocks premium features, powered end to end by RevenueCat.

## Tech stack

| Layer | Technology |
|---|---|
| App | React Native (Expo, expo-router) |
| Backend | Firebase Auth, Firestore, Cloud Functions |
| AI | Claude (Anthropic) |
| Monetization | RevenueCat + Apple In App Purchases |
| Ads | Google AdMob |
| News | Tavily |
| Traffic / ETA | Google Distance Matrix API |
| Build | EAS Build |

## Getting started

### Prerequisites

- Node.js 18+
- npm
- Expo CLI (`npx expo` works fine without installing it globally)
- A Firebase project (Auth + Firestore enabled)
- A RevenueCat project with an iOS app configured
- Xcode (for the iOS simulator/device) or the Expo Go app for quick testing

### 1. Clone the repo

```bash
git clone https://github.com/JoshuaT6186/Aibram.git
cd Aibram/Aibram
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the app

```bash
npx expo start
```

Scan the QR code with Expo Go, or press `i` / `a` to launch an iOS/Android simulator.

### 4. (Optional) Build with EAS

```bash
eas build --platform ios --profile production
```

## Project structure

```
Aibram/
├── app/                # Screens and routes (expo-router)
├── components/         # Shared UI components
├── constants/          # Theme, colors, shared constants
├── firebase/           # Firebase config and auth helpers
├── hooks/              # Custom React hooks
├── assets/             # Images, sounds, icons
└── scripts/            # Project utility scripts
```

## Monetization

Aibram+ is a monthly subscription managed entirely through RevenueCat, backed by a real Apple In App Purchase product. It includes a free trial, so you can test the full paywall and premium features without needing a promo code.

## Built for RevenueCat Shipaton 2026

I built this for Shipaton 2026, entered in the Next Gen (student) category and the Design Award category.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
