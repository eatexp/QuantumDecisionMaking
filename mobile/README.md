# Quantum Decision Lab - Mobile App

Privacy-first Decision Intelligence platform for iOS and Android.

## 🏗️ Architecture

### Technology Stack
- **Framework:** React Native 0.73+ with TypeScript
- **Database:** WatermelonDB + SQLCipher (encrypted)
- **State:** Zustand (lightweight state management)
- **Navigation:** React Navigation 6.x
- **UI:** React Native Paper (Material Design)
- **Analytics:** PostHog (privacy-first, optional)
- **Crash Reporting:** Sentry

### Privacy-First Design
- All user data encrypted at rest (AES-256 via SQLCipher)
- Encryption keys stored in hardware keychain (iOS Keychain/Android Keystore)
- No PII tracked in analytics (anonymized events only)
- GDPR compliant (data export, right to deletion)

## 📁 Project Structure

```
src/
├── database/           # WatermelonDB setup
│   ├── schema.ts       # Database schema (7 tables)
│   ├── models/         # WatermelonDB models
│   │   ├── Decision.ts
│   │   ├── Option.ts
│   │   ├── Factor.ts
│   │   ├── FactorScore.ts
│   │   ├── Outcome.ts
│   │   ├── Insight.ts
│   │   └── UserStat.ts
│   ├── adapter.ts      # SQLCipher integration
│   ├── DatabaseContext.tsx
│   └── migrations/     # Schema migrations
│
├── services/           # Business logic
│   ├── insights/       # Insight-Driven Loop (THE MOAT)
│   │   ├── insight-orchestrator.ts  # Master controller
│   │   ├── correlation-discovery.ts # Correlation engine
│   │   ├── bias-detection.ts        # Bias detection
│   │   └── accuracy-tracking.ts     # Accuracy scoring
│   ├── decision-engine.ts   # Classical MAUT algorithm
│   ├── llm-service.ts       # LLM onboarding integration
│   ├── analytics.ts         # Privacy-first analytics
│   └── notification-service.ts  # Habit stacking
│
├── screens/            # UI screens
│   ├── onboarding/
│   │   ├── WelcomeScreen.tsx
│   │   ├── LLMOnboardingScreen.tsx
│   │   └── DecisionReviewScreen.tsx
│   ├── decisions/
│   │   ├── DecisionListScreen.tsx
│   │   ├── DecisionDetailScreen.tsx
│   │   └── DecisionEditScreen.tsx
│   ├── outcomes/
│   │   └── LogOutcomeScreen.tsx
│   ├── insights/
│   │   ├── InsightFeedScreen.tsx
│   │   └── InsightDetailScreen.tsx
│   └── settings/
│       ├── SettingsScreen.tsx
│       └── PrivacyScreen.tsx
│
├── components/         # Reusable components
│   ├── InsightCard.tsx
│   ├── DecisionCard.tsx
│   └── FactorSlider.tsx
│
├── navigation/         # React Navigation setup
│   ├── RootNavigator.tsx
│   └── MainNavigator.tsx
│
├── hooks/              # Custom React hooks
│   ├── useDatabase.ts
│   └── useInsights.ts
│
├── utils/              # Utility functions
│   ├── crypto.ts       # Encryption key management
│   ├── cognitive-load-limits.ts
│   └── statistics.ts   # Statistical helpers
│
└── App.tsx             # Root component
```

## 🚀 Getting Started

### Prerequisites
- Node.js ≥18.0.0
- npm ≥9.0.0
- Xcode (for iOS)
- Android Studio (for Android)

### Installation

```bash
# Install dependencies
npm install

# iOS: Install pods
cd ios && pod install && cd ..

# Create .env file (see .env.example)
cp .env.example .env
```

### Run Development Build

```bash
# iOS
npm run ios

# Android
npm run android

# Start Metro bundler separately
npm start
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- database/models/Decision.test.ts

# Watch mode
npm run test:watch
```

### Test Coverage Targets
- Services: ≥80%
- Models: ≥70%
- Utils: ≥90%

## 🏛️ Database Schema

### Core Tables
1. **decisions** - User decision problems
2. **options** - Alternatives for each decision
3. **factors** - Decision criteria (e.g., "Salary", "Location")
4. **factor_scores** - Option × Factor matrix
5. **outcomes** - Real-world results (THE CRITICAL TABLE)
6. **insights** - Generated insights from outcomes
7. **user_stats** - Gamification state (streaks, badges)

See `src/database/schema.ts` for full schema.

## 🔐 Security

### Encryption
- **At Rest:** SQLCipher AES-256 encryption
- **Key Storage:** iOS Keychain / Android Keystore (hardware-backed)
- **Network:** TLS 1.3 for all API calls

### Privacy Compliance
- GDPR: Data export, right to deletion, consent management
- CCPA: Opt-out available for analytics
- No third-party trackers (no Facebook Pixel, Google Ads)

### Data Classification
**On-Device Only (Encrypted):**
- Decision titles, descriptions
- Factor names, weights
- Outcome notes
- Personal insights

**Cloud-Permissible (Anonymized):**
- Usage events (e.g., "decision_created")
- Aggregate statistics (e.g., "avg factors per decision")
- No decision content

## 📊 Performance Requirements

| Metric | Target | Critical? |
|--------|--------|-----------|
| App Launch (Cold Start) | <1.5s | ✅ Yes |
| Outcome Log → Insight | <2s | ✅ **CRITICAL** |
| Database Query (50 outcomes) | <50ms | ✅ Yes |
| Decision Calculation (10 factors) | <100ms | ⚠️ Important |
| LLM Onboarding Parse | <3s | ⚠️ Important |

## 🎯 Phase 1 Success Metrics

### Go/No-Go Metric (Week 12)
- **4-Week Retention:** >30% ← **PRIMARY METRIC**

### Supporting Metrics
- Day 1 Retention: >70%
- Average Outcomes Logged: ≥3 per user
- Insight Engagement Rate: >50%
- LLM Onboarding Conversion: >60%

## 🛠️ Development Workflow

### Code Style
- **Linting:** ESLint with TypeScript rules
- **Formatting:** Prettier (auto-format on save)
- **Type Checking:** TypeScript strict mode

```bash
# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

### Commit Message Convention
Follow Conventional Commits:
```
feat: Add correlation discovery engine
fix: Fix encryption key generation on Android
docs: Update setup guide
test: Add tests for Insight Orchestrator
```

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes

## 🐛 Debugging

### React Native Debugger
```bash
# Open React Native Debugger
open "rndebugger://set-debugger-loc?host=localhost&port=8081"
```

### Flipper
Integrated debugging tool:
- Network inspector
- Database inspector (WatermelonDB)
- Layout inspector
- Logs viewer

### Common Issues
See `SETUP_AND_DEPLOYMENT_GUIDE.md` troubleshooting section.

## 📦 Building for Production

### iOS (TestFlight)
```bash
cd ios
fastlane beta
```

### Android (Play Console)
```bash
cd android
./gradlew bundleRelease
```

See `SETUP_AND_DEPLOYMENT_GUIDE.md` for detailed instructions.

## 📚 Documentation

- **[Phase 1 Technical Roadmap](../PHASE_1_MVP_TECHNICAL_ROADMAP.md)** - 3-month plan
- **[Architecture](../PHASE_1_ARCHITECTURE.md)** - System design
- **[Data Schema](../PHASE_1_DATA_SCHEMA.md)** - Database details
- **[Implementation Guides](../):**
  - Privacy Architecture
  - Insight-Driven Loop
  - LLM Onboarding

## 🤝 Contributing

1. Create feature branch from `develop`
2. Write tests for new code
3. Run lint, format, type-check
4. Submit PR with clear description
5. Await code review

## 📄 License

Proprietary - All Rights Reserved (2025)

## 🙋 Support

- **Issues:** See GitHub Issues
- **Team Chat:** [Slack/Discord]
- **Docs:** See `/docs` folder

---

**Built with ❤️ using React Native and WatermelonDB**
