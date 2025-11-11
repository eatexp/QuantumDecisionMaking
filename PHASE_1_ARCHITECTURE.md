# Phase 1 MVP: System Architecture
## Quantum Decision Lab - Privacy-First, On-Device Architecture

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Status:** DRAFT - Architectural Blueprint

---

## 1. Architecture Overview

### 1.1 Guiding Principles

The Phase 1 architecture is designed around three non-negotiable constraints:

1. **Privacy-First**: Raw user data remains on-device by default; cloud operations are opt-in and encrypted
2. **Offline-First**: Core functionality (decision modeling, outcome logging, insight generation) works without internet
3. **Performance-Optimized**: Real-time inference (<100ms) for decisions with ≤10 factors

### 1.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER DEVICE (iOS/Android)                │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React Native Application                  │  │
│  │                                                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │ Decision │  │ Outcome  │  │ Insight  │            │  │
│  │  │ Modeling │  │ Logging  │  │ Engine   │            │  │
│  │  │   UI     │  │   UI     │  │   UI     │            │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │  │
│  │       │             │             │                    │  │
│  │  ┌────▼──────────────▼─────────────▼─────────────┐   │  │
│  │  │       Application State (Zustand/Redux)       │   │  │
│  │  └────┬────────────────┬────────────────┬─────────┘   │  │
│  │       │                │                │              │  │
│  │  ┌────▼────────┐  ┌────▼────────┐  ┌───▼───────┐     │  │
│  │  │  Classical  │  │   Insight   │  │Gamification│     │  │
│  │  │   Bayes     │  │  Generator  │  │   Engine  │     │  │
│  │  │   Engine    │  │   (Stats)   │  │           │     │  │
│  │  └────┬────────┘  └────┬────────┘  └───┬───────┘     │  │
│  │       │                │                │              │  │
│  │  ┌────▼────────────────▼────────────────▼─────────┐   │  │
│  │  │         Data Access Layer (DAL)                 │   │  │
│  │  └────┬─────────────────────────────────────────────┘   │  │
│  │       │                                                  │  │
│  │  ┌────▼──────────────────────────────────────────────┐  │  │
│  │  │  WatermelonDB (SQLite + SQLCipher Encryption)     │  │  │
│  │  │  ┌──────┐ ┌────────┐ ┌─────────┐ ┌──────────┐   │  │  │
│  │  │  │Deci- │ │Options │ │ Factors │ │ Outcomes │   │  │  │
│  │  │  │sions │ │        │ │         │ │          │   │  │  │
│  │  │  └──────┘ └────────┘ └─────────┘ └──────────┘   │  │  │
│  │  │  ┌─────────┐ ┌────────────┐                      │  │  │
│  │  │  │Insights │ │ User Stats │                      │  │  │
│  │  │  └─────────┘ └────────────┘                      │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │                                      │
│  ┌─────────────────────▼──────────────────────────────────┐  │
│  │        Device Services (Notifications, Storage)        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ HTTPS (Optional, User-Controlled)
                   │
┌──────────────────▼───────────────────────────────────────────┐
│                   CLOUD SERVICES (Minimal)                    │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │     LLM      │  │  Analytics   │  │  Backup Service  │   │
│  │   Gateway    │  │  (PostHog)   │  │  (E2E Encrypted) │   │
│  │  (Stateless) │  │ (Anonymized) │  │    (Optional)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │        Firebase/Supabase (Auth + Optional Sync)        │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. On-Device Architecture (The Core)

### 2.1 Application Layer

**Framework:** React Native (TypeScript)

**Component Architecture:**
- **UI Layer:** React components with hooks (functional components)
- **State Management:** Zustand (lightweight) or Redux Toolkit (if complex state needed)
- **Navigation:** React Navigation (stack + tab navigators)
- **Styling:** styled-components or Tailwind (via NativeWind)

**Key Screens:**
1. **Onboarding Flow**
   - Welcome → LLM input → Review structured decision
2. **Decision List**
   - Active decisions, completed decisions, archived
3. **Decision Detail**
   - Factor weighting, option scoring, recommendation display
4. **Log Outcome**
   - Satisfaction slider, notes, surprise factor
5. **Insights Feed**
   - Insight cards (unread badge), detail views
6. **Profile/Stats**
   - Streaks, badges, accuracy score, settings

---

### 2.2 Business Logic Layer

#### 2.2.1 Classical Bayesian Decision Engine

**Purpose:** Generate weighted recommendations for decisions with ≤15 factors.

**Algorithm:** Multi-Attribute Utility Theory (MAUT) + Bayesian Confidence Intervals

**Implementation (Pseudocode):**
```typescript
interface Decision {
  id: string;
  options: Option[];
  factors: Factor[];
}

interface Option {
  id: string;
  name: string;
  factorScores: Map<string, number>; // factor_id → score (0-10)
}

interface Factor {
  id: string;
  name: string;
  weight: number; // 0-1 (normalized)
}

function calculateRecommendation(decision: Decision): Recommendation {
  const scores = decision.options.map(option => {
    // Weighted sum of factor scores
    const totalScore = decision.factors.reduce((sum, factor) => {
      const factorScore = option.factorScores.get(factor.id) ?? 5; // default: neutral
      return sum + (factor.weight * factorScore);
    }, 0);

    // Normalize to 0-10 scale
    const maxPossibleScore = decision.factors.reduce((sum, f) => sum + (f.weight * 10), 0);
    const normalizedScore = (totalScore / maxPossibleScore) * 10;

    // Bayesian confidence (simplified)
    const variance = calculateVariance(option, decision.factors);
    const confidence = 1 / (1 + variance); // Higher variance → lower confidence

    return {
      optionId: option.id,
      score: normalizedScore,
      confidence: confidence
    };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return {
    topOption: scores[0],
    allScores: scores,
    sensitivityAnalysis: calculateSensitivity(decision)
  };
}

function calculateVariance(option: Option, factors: Factor[]): number {
  const scores = factors.map(f => option.factorScores.get(f.id) ?? 5);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
}
```

**Performance Requirement:** <100ms for ≤10 factors on mid-range mobile device

---

#### 2.2.2 Insight Generation Engine

**Purpose:** Generate high-value insights from logged outcomes.

**Insight Types (Phase 1):**

1. **Correlation Discovery**
   ```typescript
   function detectCorrelations(outcomes: Outcome[]): Insight[] {
     if (outcomes.length < 5) return []; // Minimum data requirement

     // Extract factor-outcome pairs
     const factorSatisfactionPairs: Map<string, number[]> = new Map();

     outcomes.forEach(outcome => {
       const decision = getDecision(outcome.decisionId);
       decision.factors.forEach(factor => {
         const scores = factorSatisfactionPairs.get(factor.name) || [];
         scores.push(outcome.actualSatisfaction);
         factorSatisfactionPairs.set(factor.name, scores);
       });
     });

     // Calculate Pearson correlation
     const insights: Insight[] = [];
     factorSatisfactionPairs.forEach((satisfactions, factorName) => {
       const correlation = pearsonCorrelation(satisfactions, outcomes.map(o => o.actualSatisfaction));

       if (Math.abs(correlation) > 0.6) { // Strong correlation threshold
         insights.push({
           type: 'correlation',
           title: `${factorName} strongly influences your satisfaction`,
           description: `Your '${factorName}' has a ${(correlation * 100).toFixed(0)}% correlation with outcome satisfaction.`,
           data: { factorName, correlation }
         });
       }
     });

     return insights;
   }
   ```

2. **Bias Detection**
   ```typescript
   function detectOverweightingBias(decisions: Decision[]): Insight | null {
     // Identify factors that are consistently weighted >0.5 but correlate poorly with satisfaction
     const factorWeights: Map<string, number[]> = new Map();

     decisions.forEach(d => {
       d.factors.forEach(f => {
         const weights = factorWeights.get(f.name) || [];
         weights.push(f.weight);
         factorWeights.set(f.name, weights);
       });
     });

     // Find consistently high-weighted factors
     factorWeights.forEach((weights, factorName) => {
       const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
       if (avgWeight > 0.5) {
         // Check if this factor actually correlates with satisfaction
         const correlation = getFactorSatisfactionCorrelation(factorName);
         if (Math.abs(correlation) < 0.3) {
           return {
             type: 'bias',
             title: `You may be overweighting '${factorName}'`,
             description: `This factor averages ${(avgWeight * 100).toFixed(0)}% importance, but shows weak correlation with your actual satisfaction.`,
             data: { factorName, avgWeight, correlation }
           };
         }
       }
     });

     return null;
   }
   ```

3. **Accuracy Tracking**
   ```typescript
   function calculateDecisionAccuracy(outcomes: Outcome[]): Insight {
     const deltas = outcomes.map(outcome => {
       const decision = getDecision(outcome.decisionId);
       const selectedOption = decision.options.find(o => o.id === decision.selectedOptionId);
       const predicted = selectedOption?.predictedSatisfaction ?? 5;
       return Math.abs(predicted - outcome.actualSatisfaction);
     });

     const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
     const accuracy = Math.max(0, 100 - (avgDelta * 10)); // Scale to 0-100

     return {
       type: 'accuracy',
       title: `Your decision accuracy: ${accuracy.toFixed(0)}%`,
       description: `On average, your predictions are off by ${avgDelta.toFixed(1)} points.`,
       data: { accuracy, avgDelta }
     };
   }
   ```

**Trigger:** Run after every outcome log + weekly batch analysis

---

#### 2.2.3 Gamification Engine

**Components:**

1. **Streak Tracker**
   ```typescript
   interface StreakState {
     currentStreak: number;
     longestStreak: number;
     lastLogDate: Date;
     streakRecoveryUsed: boolean; // One "forgiveness" per month
   }

   function updateStreak(lastState: StreakState, newLogDate: Date): StreakState {
     const daysSinceLastLog = daysBetween(lastState.lastLogDate, newLogDate);

     if (daysSinceLastLog === 1) {
       // Continue streak
       return {
         currentStreak: lastState.currentStreak + 1,
         longestStreak: Math.max(lastState.longestStreak, lastState.currentStreak + 1),
         lastLogDate: newLogDate,
         streakRecoveryUsed: lastState.streakRecoveryUsed
       };
     } else if (daysSinceLastLog === 2 && !lastState.streakRecoveryUsed) {
       // Use streak recovery (missed 1 day)
       return {
         currentStreak: lastState.currentStreak + 1,
         longestStreak: lastState.longestStreak,
         lastLogDate: newLogDate,
         streakRecoveryUsed: true
       };
     } else {
       // Streak broken
       return {
         currentStreak: 1,
         longestStreak: lastState.longestStreak,
         lastLogDate: newLogDate,
         streakRecoveryUsed: lastState.streakRecoveryUsed
       };
     }
   }
   ```

2. **Badge System**
   ```typescript
   const BADGES = [
     { id: 'first_decision', name: 'First Decision', condition: (stats) => stats.decisionsCreated >= 1 },
     { id: 'truth_seeker', name: 'Truth Seeker', condition: (stats) => stats.outcomesLogged >= 10 },
     { id: 'pattern_hunter', name: 'Pattern Hunter', condition: (stats) => stats.correlationsDiscovered >= 5 },
     { id: 'week_warrior', name: 'Week Warrior', condition: (stats) => stats.currentStreak >= 7 },
   ];

   function checkBadges(userStats: UserStats): Badge[] {
     return BADGES.filter(badge =>
       !userStats.unlockedBadges.includes(badge.id) &&
       badge.condition(userStats)
     );
   }
   ```

---

### 2.3 Data Access Layer (DAL)

**Purpose:** Abstract database operations; provide TypeScript-typed interfaces.

**Implementation:** WatermelonDB models + reactive queries

**Example Model:**
```typescript
import { Model, Q } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';

class Decision extends Model {
  static table = 'decisions';
  static associations = {
    options: { type: 'has_many', foreignKey: 'decision_id' },
    factors: { type: 'has_many', foreignKey: 'decision_id' },
    outcomes: { type: 'has_many', foreignKey: 'decision_id' }
  };

  @field('title') title!: string;
  @field('description') description?: string;
  @field('status') status!: 'active' | 'completed' | 'archived';
  @date('created_at') createdAt!: Date;
  @date('decision_date') decisionDate?: Date;

  @children('options') options!: Query<Option>;
  @children('factors') factors!: Query<Factor>;
  @children('outcomes') outcomes!: Query<Outcome>;
}
```

**Reactive Queries (for UI):**
```typescript
// Component automatically re-renders when decisions change
const decisions = useObservable(
  database.collections.get<Decision>('decisions')
    .query(Q.where('status', 'active'))
    .observe()
);
```

---

### 2.4 Local Storage & Encryption

**Database:** SQLite via WatermelonDB
**Encryption:** SQLCipher (256-bit AES)

**Key Management:**
- User PIN/biometric → derives encryption key (PBKDF2)
- Key stored in iOS Keychain / Android Keystore (secure hardware)
- No key escrow; if user loses PIN, data is unrecoverable (by design)

**Backup Strategy:**
- **Local Backup:** iOS iCloud Backup (encrypted) / Android Auto Backup
- **Optional Cloud Sync:** User opt-in, end-to-end encrypted (user's key never leaves device)

---

## 3. Cloud Services (Minimal, Optional)

### 3.1 LLM Gateway Service

**Purpose:** Proxy for OpenAI/Anthropic API calls (stateless).

**Architecture:** Serverless function (Cloudflare Workers or AWS Lambda)

**Flow:**
```
User Input (Natural Language)
    ↓
Mobile App → HTTPS POST /api/parse-decision
    ↓
Lambda Function:
  - Rate limiting (per-user, per-IP)
  - Input validation (max 500 words)
  - Call Anthropic Claude Haiku API
  - Parse JSON response
    ↓
Return Structured Decision → Mobile App
```

**Privacy:** No user data stored; logs only aggregated metrics (call count, latency).

**Cost Control:**
- Rate limit: 5 calls/user/day (Phase 1)
- Caching: Hash input → cache result for 24h (deduplication)
- Fallback: If budget exceeded, return template-based onboarding

---

### 3.2 Analytics Service

**Tool:** PostHog (self-hosted or cloud with anonymization)

**Events Tracked:**
- `app_opened`, `decision_created`, `outcome_logged`, `insight_viewed`
- `user_retained_d1`, `user_retained_d7`, `user_retained_d28`

**Privacy:**
- No PII (emails, names, IP addresses hashed)
- Event payloads contain only aggregated metadata (e.g., `num_factors: 7`, not factor names)
- User opt-out available

---

### 3.3 Optional Backup Service

**Purpose:** User-controlled cloud backup for data portability.

**Implementation:**
- Export local DB → Encrypt with user's key → Upload to S3/Firebase Storage
- Restore: Download encrypted file → Decrypt on-device → Import to local DB

**Privacy:** Zero-knowledge architecture (server cannot decrypt data)

---

## 4. Data Flow Diagrams

### 4.1 Outcome Logging → Insight Generation Flow

```
[User taps "Log Outcome"]
        ↓
[UI: Satisfaction slider (0-10), notes, surprise factor]
        ↓
[User submits] → [DAL: Insert Outcome record]
        ↓
[Trigger: Insight Generation Engine]
        ↓
[Analyze all outcomes for this user]
        ↓
    ┌───────────────────────────────┐
    │ Correlation Discovery          │ → [Insight: "Sleep correlates with Productivity"]
    │ Bias Detection                 │ → [Insight: "Overweighting 'Salary'"]
    │ Accuracy Tracking              │ → [Insight: "Your accuracy: 78%"]
    └───────────────────────────────┘
        ↓
[DAL: Insert Insight records]
        ↓
[UI: Show "New Insight!" notification]
        ↓
[User taps notification] → [Navigate to Insight Detail]
        ↓
[Mark insight as read] → [Update gamification stats]
```

---

### 4.2 LLM Onboarding Flow

```
[User enters: "I'm choosing between Job A (high salary, long commute) and Job B (lower salary, remote)"]
        ↓
[App → POST /api/parse-decision]
        ↓
[Lambda → Anthropic API with prompt:]
        |
        | System: Parse this decision into JSON:
        | {
        |   "title": "...",
        |   "options": [{"name": "..."}, ...],
        |   "factors": [{"name": "...", "weight": 0.5}, ...]
        | }
        |
        ↓
[Anthropic returns JSON]
        ↓
[Lambda validates and returns to app]
        ↓
[App displays: "Review your decision"]
        |
        | Decision: Choose Job Offer
        | Options: Job A, Job B
        | Factors: Salary (50%), Commute (30%), Work Flexibility (20%)
        |
        ↓
[User edits or confirms] → [DAL: Create Decision + Options + Factors]
        ↓
[Navigate to Decision Detail]
```

---

## 5. Performance Budget

| Operation | Target | Measurement Method |
|-----------|--------|-------------------|
| **App Cold Start** | <1.5s | Time to interactive (first render) |
| **Decision Inference (≤10 factors)** | <100ms | Function execution time |
| **Outcome Log → Insight Generation** | <2s | End-to-end (submit → notification) |
| **LLM Onboarding Parsing** | <3s | API round-trip |
| **Database Query (100 decisions)** | <50ms | WatermelonDB query time |
| **Insight Card Animation** | 60fps | React Native Reanimated profiling |

**Monitoring:** React Native Performance Monitor + Sentry for crash reporting

---

## 6. Security Architecture

### 6.1 Threat Model

| Threat | Risk Level | Mitigation |
|--------|-----------|------------|
| **Device theft → data access** | High | SQLCipher encryption + biometric lock |
| **Man-in-the-middle (LLM calls)** | Medium | TLS 1.3, certificate pinning |
| **Cloud backup interception** | Low | End-to-end encryption (zero-knowledge) |
| **Analytics data de-anonymization** | Medium | No PII, IP hashing, event aggregation |
| **Malicious LLM prompt injection** | Low | Input sanitization, output validation |

### 6.2 Compliance

**GDPR (EU):**
- ✅ Data minimization (local-first)
- ✅ Right to access (export feature)
- ✅ Right to deletion (account deletion → local DB wipe)
- ✅ Consent for cloud sync (opt-in, explicit)

**CCPA (California):**
- ✅ Data disclosure (privacy policy)
- ✅ Opt-out of analytics (settings toggle)

**BetterHelp Precedent Avoidance:**
- ✅ No third-party data sharing (no Facebook Pixel, Google Ads tracking)
- ✅ No sale of decision data

---

## 7. Scalability & Future-Proofing

### 7.1 Phase 2 Preparation (QLBN Integration)

**Current Architecture Supports:**
- Swapping Classical Bayes Engine → QLBN Engine (same interface)
- Federated Learning: Local model training → Anonymized parameter aggregation

**Required Changes for Phase 2:**
- Add TensorFlow Lite/PyTorch Mobile for QLBN inference
- Implement differential privacy for parameter sharing
- Expand cloud services for federated aggregation server

---

### 7.2 Horizontal Scaling (If B2B Launch Succeeds)

**Current Bottlenecks:**
- LLM Gateway: 100 requests/second (Lambda autoscaling)
- Analytics: PostHog Cloud handles 1M events/month

**Scaling Plan:**
- LLM: Add request queuing (SQS) + batch processing
- Analytics: Shard by user cohort
- Backup: Migrate to dedicated object storage (Backblaze B2)

---

## 8. Open Architecture Decisions

| Decision Point | Options | Recommendation | Rationale |
|----------------|---------|----------------|-----------|
| **State Management** | Zustand vs. Redux Toolkit | Zustand | Simpler, less boilerplate for Phase 1 |
| **Styling** | styled-components vs. NativeWind | NativeWind | Tailwind familiarity, faster iteration |
| **Navigation** | React Navigation vs. Expo Router | React Navigation | Mature, stable for production |
| **LLM Provider** | OpenAI vs. Anthropic | Anthropic Claude Haiku | Lower cost ($0.25/MTok vs. $0.15/MTok), better instruction-following |
| **Backend Auth** | Firebase vs. Supabase | Supabase | Open-source, PostgreSQL-based (more flexible for Phase 2) |

---

## 9. Architectural Validation Checklist

Before proceeding to implementation:

- [ ] **Privacy Review:** External audit of data flows (ensure no leaks)
- [ ] **Performance Testing:** Benchmark decision engine on target devices (iPhone 12, Samsung Galaxy S21)
- [ ] **Security Audit:** Penetration testing of LLM gateway (prevent prompt injection)
- [ ] **Cost Modeling:** Verify LLM costs stay <$0.005/user/month
- [ ] **Offline Testing:** Simulate airplane mode (all core features functional)
- [ ] **GDPR Compliance:** Legal review of privacy policy and data handling

---

## 10. Conclusion

This architecture is intentionally **simple, defensible, and focused** on the Phase 1 goal: proving the Insight-Driven Loop can solve user retention. It avoids over-engineering (no microservices, no Kubernetes) while maintaining the architectural foundations needed for Phase 2 (QLBN integration, federated learning).

**Next Step:** Finalize technology choices, set up development environment, and begin Month 1 Week 1 implementation.

---

**Document Status:** DRAFT v1.0 - Ready for Technical Review
