# Phase 1 MVP: Technology Stack Decisions
## Quantum Decision Lab - Recommended Technologies & Trade-offs

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Status:** Decision Guide for Phase 1 Implementation

---

## 1. Executive Summary

This document provides detailed recommendations for the Phase 1 MVP technology stack, analyzing trade-offs between speed-to-market, cost, performance, and Phase 2 scalability. All recommendations prioritize the **Phase 1 go/no-go metric**: achieving >30% 4-week user retention.

**Primary Recommendation:** Cross-platform mobile-first development using **React Native + TypeScript** with a **privacy-first, offline-first** architecture.

---

## 2. Platform Strategy

### 2.1 Mobile vs. Web vs. Desktop

| Platform | Phase 1 Recommendation | Rationale |
|----------|----------------------|-----------|
| **Mobile (iOS/Android)** | ✅ **PRIMARY** | 80% of decision-making happens on-the-go; push notifications critical for habit stacking |
| **Web (Progressive Web App)** | ⏸️ Phase 2 | Lower engagement for personal decision tools; defer until B2B demand validated |
| **Desktop (macOS/Windows)** | ❌ Not Planned | Minimal use case for personal decision-making; B2B may require later |

**Decision:** Mobile-first, with React Native enabling future web deployment via React Native Web if needed.

---

### 2.2 Native vs. Cross-Platform

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Native (Swift/Kotlin)** | ✅ Best performance<br>✅ Platform-specific features<br>✅ Official tooling | ❌ 2x development time<br>❌ 2x maintenance cost<br>❌ Delayed time-to-market | ❌ **Reject for Phase 1** |
| **React Native** | ✅ Single codebase<br>✅ Faster iteration<br>✅ Strong ecosystem<br>✅ TypeScript support | ⚠️ Occasional platform-specific bugs<br>⚠️ Bridge overhead (minimal for our use case) | ✅ **RECOMMENDED** |
| **Flutter** | ✅ Excellent performance<br>✅ Strong UI framework | ❌ Dart learning curve<br>❌ Smaller ecosystem vs. React Native<br>❌ Team expertise (assume JS/TS familiarity) | ⏸️ Alternative if team has Dart experience |

**Final Decision:** **React Native + TypeScript**

**Rationale:**
- Time-to-market is critical for Phase 1 validation
- TypeScript provides strong typing for complex decision logic
- Easy to hire JavaScript/React developers
- Can deploy to web later if B2B requires it (React Native Web)

---

## 3. Frontend Stack

### 3.1 React Native Framework & Tools

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **Core Framework** | React Native | 0.73+ | Latest stable release with New Architecture support |
| **Language** | TypeScript | 5.3+ | Type safety for complex decision models; better IDE support |
| **Navigation** | React Navigation | 6.x | Industry standard; deep linking support; stack + tab navigators |
| **State Management** | Zustand | 4.x | Lightweight (recommended) OR Redux Toolkit 2.x (if complex state needed) |
| **Styling** | NativeWind (Tailwind) | 4.x | Utility-first CSS; faster prototyping; smaller bundle vs. styled-components |
| **UI Components** | React Native Paper | 5.x | Material Design; accessibility built-in; saves design time |
| **Animations** | React Native Reanimated | 3.x | 60fps animations for insight cards; runs on UI thread |
| **Forms & Validation** | React Hook Form + Zod | Latest | Performant forms; TypeScript-first validation |
| **Testing** | Jest + React Native Testing Library | Latest | Unit + integration tests; follows React best practices |

---

### 3.2 State Management Decision Matrix

| Option | Learning Curve | Boilerplate | Performance | Recommendation |
|--------|---------------|-------------|-------------|----------------|
| **Zustand** | Low | Minimal | Excellent | ✅ **Phase 1 Default** (simple, fast iteration) |
| **Redux Toolkit** | Medium | Low | Excellent | ⏸️ Phase 2 if state complexity grows (time-travel debugging useful for UX research) |
| **Jotai** | Low | Minimal | Excellent | ⏸️ Alternative to Zustand (atomic state) |
| **MobX** | Medium | Low | Good | ❌ Less common in RN ecosystem |

**Recommendation:** Start with **Zustand**; migrate to Redux Toolkit in Phase 2 only if:
- State complexity exceeds 10+ global stores
- Time-travel debugging needed for UX analytics
- Team prefers Redux patterns

---

## 4. Backend & Cloud Services

### 4.1 Backend-as-a-Service (BaaS) vs. Custom Backend

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Supabase** | ✅ Open-source<br>✅ PostgreSQL (flexible for Phase 2)<br>✅ Built-in auth<br>✅ Realtime subscriptions | ⚠️ Learning curve if team unfamiliar with Postgres | ✅ **RECOMMENDED** |
| **Firebase** | ✅ Easy setup<br>✅ Google ecosystem<br>✅ Strong mobile SDKs | ❌ Vendor lock-in<br>❌ NoSQL (less flexible for complex queries in Phase 2) | ⏸️ Alternative (faster Phase 1, harder Phase 2) |
| **Custom (Node.js + Postgres)** | ✅ Full control<br>✅ No vendor lock-in | ❌ High setup cost<br>❌ DevOps overhead<br>❌ Delays Phase 1 launch | ❌ Defer to Phase 3 (B2B scale) |

**Final Decision:** **Supabase**

**Rationale:**
- Open-source (no lock-in; can self-host later)
- PostgreSQL enables complex B2B queries in Phase 2
- Built-in auth saves 1-2 weeks of development
- Generous free tier ($0/month for beta testing)

---

### 4.2 Cloud Services Breakdown

| Service | Provider | Technology | Phase 1 Usage | Cost (Beta Phase) |
|---------|----------|-----------|---------------|------------------|
| **Auth** | Supabase | Supabase Auth | Optional cloud sync login | Free tier |
| **LLM Gateway** | Cloudflare Workers | Serverless function | Proxy for Anthropic API | <$5/month |
| **LLM Provider** | Anthropic | Claude Haiku | NLP parsing for onboarding | ~$10-20/month (100 users × 2 onboardings/user) |
| **Analytics** | PostHog | Self-hosted or Cloud | Retention tracking | Free tier (self-hosted) or <$20/month |
| **Storage (Backup)** | Supabase | PostgreSQL + S3 | Optional encrypted backups | Free tier |
| **Crash Reporting** | Sentry | Cloud SaaS | Error tracking | Free tier (5k events/month) |
| **Notifications** | Firebase Cloud Messaging (FCM) | Free | Push notifications | Free |

**Total Estimated Cost (100 beta users):** <$50/month

---

### 4.3 LLM Provider Decision

| Provider | Model | Cost (Input/Output per 1M tokens) | Latency | Instruction-Following | Recommendation |
|----------|-------|----------------------------------|---------|---------------------|----------------|
| **Anthropic** | Claude Haiku | $0.25 / $1.25 | ~1-2s | Excellent | ✅ **RECOMMENDED** |
| **OpenAI** | GPT-4o-mini | $0.15 / $0.60 | ~1-2s | Very Good | ⏸️ Alternative (slightly cheaper, less reliable for structured output) |
| **Google** | Gemini Flash | $0.075 / $0.30 | ~1-3s | Good | ⏸️ Cheapest option (if budget critical) |

**Final Decision:** **Anthropic Claude Haiku**

**Rationale:**
- Best instruction-following for structured JSON output (critical for LLM onboarding)
- Cost difference is negligible for Phase 1 scale (~$10/month difference)
- Anthropic's focus on safety/reliability aligns with privacy-first brand

**Prompt Template (Decision Parsing):**
```typescript
const ONBOARDING_PROMPT = `
You are a decision structuring assistant. Parse this user's decision description into JSON.

Input: "${userInput}"

Output JSON (no markdown, just raw JSON):
{
  "title": "Brief decision title (max 60 chars)",
  "options": [
    {"name": "Option 1 name"},
    {"name": "Option 2 name"}
  ],
  "factors": [
    {"name": "Factor 1", "weight": 0.3},
    {"name": "Factor 2", "weight": 0.25}
  ]
}

Rules:
- Limit to 2-4 options
- Limit to 5-10 factors (max 15)
- Weights must sum to 1.0
- Infer weights from user's language (e.g., "most important" → higher weight)
`;
```

---

## 5. Data Layer

### 5.1 Local Database

| Technology | Pros | Cons | Recommendation |
|-----------|------|------|----------------|
| **WatermelonDB** | ✅ Reactive (observable queries)<br>✅ Optimized for React Native<br>✅ Built-in sync<br>✅ SQLite under the hood | ⚠️ Smaller community vs. Realm | ✅ **RECOMMENDED** |
| **Realm** | ✅ Very fast<br>✅ Large community<br>✅ MongoDB integration | ❌ Vendor-specific query language<br>❌ Heavyweight | ⏸️ Alternative (if team has Realm experience) |
| **SQLite (direct)** | ✅ Full control<br>✅ Standard SQL | ❌ No reactivity (manual re-queries)<br>❌ More boilerplate | ❌ Too low-level for Phase 1 |
| **AsyncStorage** | ✅ Simple | ❌ Key-value only (not relational)<br>❌ No query support | ❌ Insufficient for decision models |

**Final Decision:** **WatermelonDB**

**Rationale:**
- Reactive queries perfect for React (UI auto-updates when data changes)
- Lazy loading optimizes performance for large datasets (future-proof)
- Built-in sync will accelerate Phase 2 federated learning

---

### 5.2 Encryption

| Technology | Type | Recommendation |
|-----------|------|----------------|
| **SQLCipher** | Database encryption (AES-256) | ✅ **REQUIRED** (via `@craftzdog/react-native-sqlite-storage`) |
| **react-native-keychain** | Secure credential storage | ✅ **REQUIRED** (store encryption key) |
| **Expo SecureStore** | Alternative keychain (if using Expo) | ⏸️ Use if Expo-managed workflow |

**Implementation:**
```typescript
import SQLite from '@craftzdog/react-native-sqlite-storage';
import * as Keychain from 'react-native-keychain';

// On app first launch: generate encryption key
const encryptionKey = await generateSecureKey(); // PBKDF2 from user PIN or random
await Keychain.setGenericPassword('db_key', encryptionKey);

// Open encrypted database
const db = SQLite.openDatabase({
  name: 'quantumdecisions.db',
  location: 'default',
  key: encryptionKey // SQLCipher encryption
});
```

---

## 6. On-Device ML & Statistics

### 6.1 Classical Bayesian Engine

| Component | Technology | Recommendation |
|-----------|-----------|----------------|
| **Statistical Library** | simple-statistics (JS) | ✅ Lightweight; sufficient for correlation, mean, variance |
| **Advanced Stats** | jStat (JS) | ⏸️ If Bayesian inference needed beyond simple formulas |
| **Linear Algebra** | math.js | ✅ Matrix operations for factor scoring |
| **ML Inference (Phase 2)** | TensorFlow Lite (via react-native-pytorch-core) | ⏸️ Defer to Phase 2 (QLBN integration) |

**Phase 1 Implementation (Pure JavaScript):**
```typescript
import { mean, standardDeviation, sampleCorrelation } from 'simple-statistics';

function calculateDecisionScore(option: Option, factors: Factor[]): number {
  const weightedScores = factors.map(factor => {
    const score = option.getFactorScore(factor.id) ?? 5;
    return factor.weight * score;
  });

  return weightedScores.reduce((sum, score) => sum + score, 0);
}

function detectCorrelation(factorValues: number[], satisfactions: number[]): number {
  if (factorValues.length < 5) return 0; // Insufficient data
  return sampleCorrelation(factorValues, satisfactions);
}
```

**No ML framework needed for Phase 1** (classical statistics sufficient).

---

## 7. Developer Tools & Workflow

### 7.1 Development Environment

| Tool | Technology | Purpose |
|------|-----------|---------|
| **Package Manager** | pnpm | Faster installs; disk space efficient; strict dependencies |
| **Code Editor** | VS Code | TypeScript IntelliSense; React Native Tools extension |
| **Linter** | ESLint + Prettier | Code quality; auto-formatting |
| **Type Checking** | TypeScript Compiler | Strict mode enabled (`strict: true`) |
| **Git Hooks** | Husky + lint-staged | Pre-commit linting; prevent broken commits |
| **CI/CD** | GitHub Actions | Automated testing; build iOS/Android on push |

---

### 7.2 Testing Strategy

| Test Type | Framework | Coverage Target | Phase 1 Priority |
|-----------|-----------|----------------|------------------|
| **Unit Tests** | Jest | 80%+ for business logic | ✅ HIGH (decision engine, insight generation) |
| **Component Tests** | React Native Testing Library | 60%+ for UI components | ⏸️ MEDIUM (focus on critical flows) |
| **Integration Tests** | Detox | 5-10 critical user flows | ⏸️ MEDIUM (onboarding, outcome logging) |
| **E2E Tests** | Manual QA | 100% of user stories | ✅ HIGH (before beta launch) |

**Priority Test Coverage:**
1. Decision engine calculations (unit tests)
2. Insight generation logic (unit tests)
3. Streak tracking (unit tests)
4. LLM onboarding flow (integration test)
5. Outcome logging → insight delivery (integration test)

---

### 7.3 Build & Deployment

| Platform | Build Tool | Distribution | Beta Testing |
|----------|-----------|--------------|--------------|
| **iOS** | Xcode + Fastlane | TestFlight | ✅ 100 external testers (Apple limit) |
| **Android** | Gradle + Fastlane | Google Play Internal Testing | ✅ Unlimited testers |

**Recommended Workflow:**
1. Local development: `npx react-native run-ios` / `run-android`
2. Beta builds: GitHub Actions → Fastlane → TestFlight/Play Console
3. Automated versioning: Semantic versioning (`1.0.0-beta.1`, `1.0.0-beta.2`, etc.)

---

## 8. Cost Analysis (Phase 1 Beta)

### 8.1 Monthly Recurring Costs (100 Beta Users)

| Service | Cost | Assumptions |
|---------|------|-------------|
| **Supabase** | $0 | Free tier (500MB database, 50k MAU) |
| **Anthropic API** | $15 | 100 users × 2 onboarding sessions × $0.075/session |
| **Cloudflare Workers** | $0 | Free tier (100k requests/day) |
| **PostHog** | $0 | Self-hosted OR free tier (1M events/month) |
| **Sentry** | $0 | Free tier (5k errors/month) |
| **Firebase (Notifications)** | $0 | Free |
| **Apple Developer** | $8.25/mo | $99/year |
| **Google Play Developer** | One-time $25 | Amortized over 12 months: ~$2/mo |

**Total Phase 1 Cost:** ~$25-30/month

---

### 8.2 One-Time Development Costs

| Item | Estimated Cost | Notes |
|------|---------------|-------|
| **Developer Accounts** | $124 | Apple ($99) + Google ($25) |
| **Design Assets** | $0-500 | Use Figma free tier + React Native Paper (pre-designed components) |
| **Third-Party Integrations** | $0 | All services have free tiers for beta |

**Total One-Time:** ~$124-$624

---

## 9. Risk Mitigation & Contingencies

### 9.1 Technical Risks

| Risk | Probability | Mitigation |
|------|-------------|------------|
| **React Native performance issues** | Low | Benchmark early; fallback to native modules if needed |
| **LLM API rate limits** | Medium | Implement client-side caching; queue requests; fallback to manual entry |
| **Database encryption overhead** | Low | SQLCipher adds <5% overhead; test on low-end devices |
| **Offline sync conflicts** | Low (Phase 1) | Defer multi-device sync to Phase 2; single-device for beta |

---

### 9.2 Vendor Lock-In Analysis

| Vendor | Lock-In Risk | Mitigation |
|--------|-------------|------------|
| **Supabase** | Low | Open-source; can self-host; PostgreSQL is portable |
| **Anthropic** | Medium | Abstract LLM calls behind interface; easy to swap providers |
| **React Native** | Low | Can eject to native projects if needed |
| **WatermelonDB** | Medium | SQLite underneath; can export/migrate data |

**Strategy:** All third-party services are abstracted behind interfaces/adapters for easy swapping.

---

## 10. Phase 2 Scalability Considerations

### 10.1 What Changes in Phase 2?

| Component | Phase 1 | Phase 2 (QLBN Integration) |
|-----------|---------|---------------------------|
| **Decision Engine** | Classical Bayes (JavaScript) | QLBN (TensorFlow Lite / PyTorch Mobile) |
| **Insight Generation** | Simple correlation (on-device) | Federated learning (cloud aggregation) |
| **Backend** | Minimal (Supabase for auth/backup) | Federated aggregation server (custom Node.js or Python) |
| **Data Sync** | Optional single-device backup | Multi-device sync + federated parameter sharing |
| **Cost** | ~$30/month | ~$500-1000/month (depends on user scale) |

---

### 10.2 Technology Choices That Future-Proof Phase 2

✅ **Good Choices for Scalability:**
- Supabase (PostgreSQL scales well for B2B analytics)
- WatermelonDB (built-in sync support)
- Modular architecture (easy to swap decision engine)

⚠️ **Potential Bottlenecks:**
- LLM calls (if usage spikes; solution: rate limiting + caching)
- On-device inference for 15-factor QLBN (solution: cloud offload or factor limit)

---

## 11. Final Recommendations Summary

### 11.1 Definitive Stack for Phase 1 MVP

**Frontend:**
- React Native 0.73+ (TypeScript)
- Zustand (state management)
- React Navigation (navigation)
- NativeWind (styling)
- React Native Paper (UI components)
- WatermelonDB + SQLCipher (local database)

**Backend:**
- Supabase (auth, optional backup)
- Cloudflare Workers (LLM gateway)
- Anthropic Claude Haiku (LLM)
- PostHog (analytics)
- Firebase Cloud Messaging (push notifications)

**DevOps:**
- GitHub Actions (CI/CD)
- Fastlane (automated builds)
- Sentry (error tracking)
- Jest + React Native Testing Library (testing)

---

### 11.2 Decision Approval Checklist

Before beginning implementation:

- [ ] **Platform confirmed:** Mobile-first (iOS + Android)
- [ ] **Framework confirmed:** React Native + TypeScript
- [ ] **Database confirmed:** WatermelonDB + SQLCipher
- [ ] **LLM provider confirmed:** Anthropic Claude Haiku
- [ ] **Backend confirmed:** Supabase
- [ ] **Budget approved:** ~$30/month for Phase 1 beta
- [ ] **Team has JavaScript/TypeScript expertise** (or training plan)
- [ ] **Apple Developer account activated** ($99/year)
- [ ] **Google Play Developer account activated** ($25 one-time)

---

## 12. Alternative Stacks (For Discussion)

### 12.1 If Team Prefers Native Development

**Stack:**
- iOS: Swift + SwiftUI + Core Data + Core ML
- Android: Kotlin + Jetpack Compose + Room + ML Kit
- Shared: REST API for LLM gateway

**Trade-offs:**
- ✅ Best performance, platform integration
- ❌ 2x development time (6 months instead of 3 for Phase 1)
- ❌ Higher ongoing maintenance cost

**Verdict:** Only choose if team has strong native expertise AND timeline is flexible.

---

### 12.2 If Team Prefers Flutter

**Stack:**
- Flutter + Dart
- Riverpod (state management)
- SQLite + sqflite_sqlcipher
- http package for API calls

**Trade-offs:**
- ✅ Excellent performance
- ✅ Beautiful UI out-of-the-box
- ❌ Dart learning curve
- ❌ Smaller ecosystem than React Native

**Verdict:** Valid alternative if team has Dart experience.

---

## Conclusion

The recommended stack (**React Native + Supabase + Anthropic**) is optimized for:
1. **Speed to market** (3-month Phase 1 timeline)
2. **Cost efficiency** (~$30/month for beta)
3. **Developer productivity** (JavaScript ecosystem, strong tooling)
4. **Privacy compliance** (SQLCipher, on-device first)
5. **Phase 2 scalability** (modular architecture, PostgreSQL)

**Next Step:** Obtain stakeholder approval, set up development environment, and begin Month 1 Week 1 implementation.

---

**Document Status:** DRAFT v1.0 - Ready for Stakeholder Review
