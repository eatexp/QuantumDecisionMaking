# Phase 1 MVP: Technical Roadmap (Months 1-3)
## Quantum Decision Lab - Classical MVP Development

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Phase Goal:** Validate the Insight-Driven Loop and achieve >30% 4-week user retention

---

## Executive Summary

Phase 1 focuses exclusively on **de-risking the single greatest project threat**: user abandonment due to outcome-logging friction. This phase deliberately defers the Quantum-Like Bayesian Network (QLBN) integration in favor of a classical probabilistic engine that can validate the core engagement model.

**Success Metric:** >30% 4-week user retention in closed beta
**Timeline:** Months 1-3
**Go/No-Go Decision Point:** End of Month 3

---

## 1. Core Features & Technical Requirements

### 1.1 The Insight-Driven Loop (THE MOAT)

**Priority:** CRITICAL - This is the entire foundation of user retention.

**Components:**
1. **Outcome Logging Interface**
   - Frictionless outcome entry (< 30 seconds to log)
   - Rich data capture: actual outcome, satisfaction score (1-10), surprise factor
   - Timestamp and context tracking

2. **Instant Insight Engine**
   - **Trigger:** Every outcome log must generate ≥1 high-value insight within 2 seconds
   - **Insight Types for Phase 1 (Classical):**
     - **Correlation Discovery:** "Your 'Sleep Quality' has a 0.78 correlation with 'Productivity'"
     - **Pattern Recognition:** "You consistently overestimate 'Time Required' by 23%"
     - **Bias Detection:** "You've logged 8 decisions; 6 were influenced by 'Social Pressure'"
     - **Accuracy Tracking:** "Your decision accuracy improved 15% this month"
     - **Counterfactual Analysis:** "If you had chosen Option B, predicted satisfaction: 6.2/10"

3. **Insight Delivery UX**
   - Visual "insight card" animation
   - Progressive disclosure (teaser → full insight)
   - Shareability (optional, privacy-controlled)

**Technical Stack:**
- Statistical analysis: Correlation (Pearson/Spearman), regression models
- Pattern matching: Time-series analysis for bias detection
- Data requirement: Minimum 3-5 logged outcomes for correlation insights

---

### 1.2 LLM-Powered Onboarding

**Priority:** CRITICAL - Solves the "cold start" problem and delivers instant value.

**User Flow:**
1. User enters natural language description: *"I'm deciding between two job offers: Company A pays more but has a longer commute, Company B offers remote work but lower salary."*
2. LLM parses and structures:
   - **Decision:** "Choose between Job Offer A and Job Offer B"
   - **Options:** ["Company A", "Company B"]
   - **Factors:** ["Salary", "Commute Time", "Work Flexibility", "Career Growth"]
   - **Pre-populated weights:** Initial suggestions based on language analysis
3. User reviews/edits the structured model
4. Decision is ready for analysis in <60 seconds

**Technical Implementation:**
- **LLM Provider:** OpenAI GPT-4o-mini or Anthropic Claude Haiku (cost-optimized)
- **Prompt Engineering:**
  ```
  Parse this decision into structured JSON:
  {
    "decision_title": "...",
    "options": ["...", "..."],
    "factors": [{"name": "...", "weight": 0.0-1.0}, ...],
    "user_preferences": {}
  }
  Limit to 10 factors maximum.
  ```
- **Fallback:** Template-based onboarding if LLM unavailable
- **Privacy:** LLM calls are stateless; no user data retained by provider

**Cost Estimate:** ~$0.001-$0.005 per onboarding session

---

### 1.3 Classical Decision Engine

**Priority:** HIGH - Functional but simple; QLBN deferred to Phase 2.

**Algorithm:** Multi-Attribute Utility Theory (MAUT) with Bayesian priors

**Core Capabilities:**
1. **Factor Weighting:** Pairwise comparison interface (reduces cognitive load)
2. **Option Scoring:** Weighted sum with uncertainty bands
3. **Sensitivity Analysis:** "If 'Salary' importance increases by 20%, Option A becomes optimal"
4. **Confidence Scoring:** Bayesian confidence intervals on recommendations

**Constraints:**
- Maximum 15 factors per decision (enforced by UI)
- On-device processing for ≤10 factors
- Cloud processing for 11-15 factors (async, <5 seconds)

**Implementation:**
- Language: Python (backend), Swift/Kotlin (on-device)
- Libraries: NumPy/SciPy for classical Bayes, PyMC for probabilistic modeling
- On-device: TensorFlow Lite or Core ML for iOS/Android inference

---

### 1.4 Gamification System

**Priority:** MEDIUM-HIGH - Reinforces the Insight-Driven Loop.

**Features:**
1. **Logging Streaks**
   - Daily/weekly streak counter
   - Streak recovery (1 "forgiveness" per month)
   - Visual progress bar

2. **Badges & Achievements**
   - "First Decision" (onboarding complete)
   - "Truth Seeker" (logged 10 outcomes)
   - "Pattern Hunter" (discovered 5 correlations)
   - "Consistent" (7-day logging streak)

3. **Decision Accuracy Score**
   - Formula: `Accuracy = Σ(Predicted_Satisfaction - Actual_Satisfaction)² / N`
   - Lower score = better accuracy
   - Personalized benchmarking (user vs. their past performance)

**Data Requirements:**
- Persistent streak counter (reset logic)
- Badge state machine (locked → unlocked → claimed)
- Historical accuracy calculation

---

### 1.5 Habit Stacking Prompts

**Priority:** MEDIUM - Long-term retention mechanism.

**Implementation:**
1. **Onboarding Question:** "When do you typically reflect on your day?" (e.g., "morning coffee," "evening journaling")
2. **Smart Notifications:**
   - Triggered by user-defined routine anchor
   - Adaptive timing (learns optimal send times)
   - Actionable: "Log yesterday's decision outcome in 30 seconds"

3. **Contextual Triggers (Phase 1.5 - Optional):**
   - Location-based (e.g., "You're at the office—log your 'Project Choice' outcome")
   - Calendar integration (e.g., "Meeting ended—log 'Vendor Selection' result")

**Technical Stack:**
- Local notifications (iOS/Android)
- ML-based optimal timing (send-time optimization)
- Privacy-first: All processing on-device

---

## 2. Privacy-First Architecture

### 2.1 On-Device/Cloud Split

**Guiding Principle:** Raw user data NEVER leaves the device by default.

**On-Device (Local Storage):**
- All decision models
- All outcome logs
- User preferences and settings
- Gamification state (streaks, badges)
- Personal insights history

**Cloud (Optional, User-Controlled):**
- Anonymized aggregate statistics (for future federated learning)
- Backup/sync (end-to-end encrypted)
- LLM onboarding calls (stateless, no data retention)
- Complex model processing (11-15 factor decisions)

**Legal Compliance:**
- GDPR: Data minimization, on-device default, explicit consent for cloud sync
- CCPA: User data export, deletion on request
- Avoids "BetterHelp precedent" (no third-party data sharing)

---

### 2.2 Data Architecture

**Local Database:** SQLite (cross-platform) with SQLCipher encryption

**Schema (Simplified):**

```sql
-- Decisions Table
CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('active', 'completed', 'archived')),
    selected_option_id TEXT,
    decision_date TIMESTAMP
);

-- Options Table
CREATE TABLE options (
    id TEXT PRIMARY KEY,
    decision_id TEXT REFERENCES decisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    predicted_satisfaction REAL CHECK(predicted_satisfaction BETWEEN 0 AND 10)
);

-- Factors Table
CREATE TABLE factors (
    id TEXT PRIMARY KEY,
    decision_id TEXT REFERENCES decisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    weight REAL CHECK(weight BETWEEN 0 AND 1),
    display_order INTEGER
);

-- Factor Scores (Option × Factor matrix)
CREATE TABLE factor_scores (
    id TEXT PRIMARY KEY,
    option_id TEXT REFERENCES options(id) ON DELETE CASCADE,
    factor_id TEXT REFERENCES factors(id) ON DELETE CASCADE,
    score REAL CHECK(score BETWEEN 0 AND 10),
    UNIQUE(option_id, factor_id)
);

-- Outcomes Table (THE CRITICAL DATA FOR THE INSIGHT LOOP)
CREATE TABLE outcomes (
    id TEXT PRIMARY KEY,
    decision_id TEXT REFERENCES decisions(id) ON DELETE CASCADE,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actual_satisfaction REAL CHECK(actual_satisfaction BETWEEN 0 AND 10),
    surprise_factor INTEGER CHECK(surprise_factor BETWEEN -3 AND 3),
    notes TEXT,
    context_tags TEXT -- JSON array
);

-- Insights Table (Generated insights for UX delivery)
CREATE TABLE insights (
    id TEXT PRIMARY KEY,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    insight_type TEXT CHECK(insight_type IN ('correlation', 'bias', 'accuracy', 'pattern', 'counterfactual')),
    title TEXT NOT NULL,
    description TEXT,
    data_payload TEXT, -- JSON with supporting data
    is_read BOOLEAN DEFAULT 0,
    related_decision_ids TEXT -- JSON array
);

-- Gamification State
CREATE TABLE user_stats (
    metric_key TEXT PRIMARY KEY,
    metric_value TEXT, -- Flexible: can store numbers, JSON, etc.
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Examples: 'current_streak', 'longest_streak', 'total_outcomes_logged', 'badges_earned'
```

**Cloud Schema (Phase 2 - Federated Learning):**
- Only aggregated, anonymized model parameters
- No individual decision data
- Differential privacy mechanisms

---

### 2.3 Performance Requirements

**Critical Metrics:**
- Outcome logging flow: <30 seconds (onboarding → log)
- Insight generation: <2 seconds after outcome submission
- On-device inference: <100ms for ≤10 factors
- App launch time: <1.5 seconds (cold start)
- Offline capability: 100% functional without internet (except LLM onboarding)

---

## 3. Technology Stack Recommendations

### 3.1 Mobile-First Approach

**Platform:** Cross-platform native (React Native or Flutter)

**Rationale:**
- Single codebase for iOS/Android (faster iteration for Phase 1)
- Native performance for on-device ML inference
- Access to platform-specific APIs (notifications, local storage, ML frameworks)

**Alternative (Native):**
- iOS: Swift + SwiftUI + Core Data + Core ML
- Android: Kotlin + Jetpack Compose + Room + ML Kit
- **Trade-off:** Better performance, higher development cost

---

### 3.2 Recommended Stack (Cross-Platform)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Frontend** | React Native + TypeScript | Cross-platform, strong typing, large ecosystem |
| **State Management** | Zustand or Redux Toolkit | Predictable state, easy debugging |
| **Local Database** | WatermelonDB (over SQLite) | Reactive, performant, excellent for offline-first |
| **Encryption** | SQLCipher via react-native-sqlcipher | Industry-standard database encryption |
| **On-Device ML** | TensorFlow Lite (via react-native-pytorch-core or custom bridge) | Classical Bayes inference, future QLBN prep |
| **Statistical Analysis** | JavaScript stats libraries (simple-statistics, jStat) | Correlation, regression for insights |
| **LLM Integration** | OpenAI API or Anthropic API (stateless calls) | Onboarding NLP parsing |
| **Cloud Backend (Phase 1.5)** | Firebase or Supabase | Auth, optional backup, analytics |
| **Notifications** | react-native-push-notification | Habit stacking reminders |
| **Analytics (Privacy-First)** | PostHog (self-hosted) or Mixpanel (anonymized) | User behavior tracking for retention analysis |

---

### 3.3 Backend Services (Minimal for Phase 1)

**Phase 1 Backend Needs:**
1. **LLM Gateway:** Stateless proxy for OpenAI/Anthropic calls
2. **Analytics Ingestion:** Anonymous usage events for retention metrics
3. **Optional Backup Service:** End-to-end encrypted cloud sync

**Recommended Architecture:**
- **Serverless Functions:** Cloudflare Workers or AWS Lambda
- **Authentication:** Firebase Auth or Supabase Auth (for optional cloud sync)
- **Storage (Backup):** AWS S3 with client-side encryption

**Cost Estimate (Phase 1, 100 beta users):**
- LLM calls: ~$5-10/month
- Serverless functions: <$5/month (free tier)
- Analytics: Free tier (PostHog/Mixpanel)
- **Total:** <$20/month

---

## 4. Detailed Months 1-3 Roadmap

### Month 1: Foundation & Core Loop

**Week 1-2: Project Setup & Data Layer**
- [ ] Initialize React Native project (TypeScript, ESLint, Prettier)
- [ ] Configure WatermelonDB with schema (decisions, options, factors, outcomes, insights)
- [ ] Implement SQLCipher encryption
- [ ] Build local data access layer (DAL) with TypeScript interfaces
- [ ] Write unit tests for DAL (CRUD operations)
- [ ] Set up analytics framework (PostHog integration, anonymized events)

**Week 3-4: Decision Modeling UI**
- [ ] Design and implement "Create Decision" flow
  - Manual factor entry (fallback for LLM)
  - Pairwise comparison UI for factor weighting
  - Option scoring interface
- [ ] Implement classical Bayes decision engine
  - Multi-Attribute Utility Theory (MAUT) algorithm
  - Confidence scoring
  - Sensitivity analysis
- [ ] Build "Decision Detail" view with recommendation display
- [ ] Add local unit tests for decision engine (10-15 factor edge cases)

**Milestone 1 (End of Month 1):**
- ✅ Users can manually create a decision with ≤15 factors
- ✅ Classical engine generates weighted recommendations
- ✅ All data stored locally and encrypted
- ✅ No LLM integration yet (focus on core logic)

---

### Month 2: The Insight-Driven Loop

**Week 5-6: Outcome Logging & Insight Generation**
- [ ] Build "Log Outcome" UI (satisfaction score, surprise factor, notes)
- [ ] Implement insight generation engine:
  - Correlation discovery (Pearson coefficient for ≥5 outcomes)
  - Accuracy tracking (predicted vs. actual satisfaction)
  - Bias detection (factor overweighting patterns)
- [ ] Design insight card UI with animations
- [ ] Implement insight notification system (badge on outcome log)
- [ ] Add A/B testing framework for insight presentation variants

**Week 7-8: Gamification & Habit Stacking**
- [ ] Build streak tracking system
  - Daily/weekly counters
  - Streak recovery logic
  - Local push notifications for streak reminders
- [ ] Implement badge system (5 initial badges)
  - State machine (locked → unlocked → claimed)
  - Badge unlock animations
- [ ] Build "Decision Accuracy Score" calculation and display
- [ ] Implement habit stacking onboarding question
- [ ] Configure adaptive notification timing (ML-based send-time optimization)

**Milestone 2 (End of Month 2):**
- ✅ Outcome logging triggers instant insights (<2 seconds)
- ✅ Gamification system functional (streaks, badges, accuracy score)
- ✅ Habit stacking prompts configured
- ✅ **Internal testing begins:** Dogfood with 5-10 team members

---

### Month 3: LLM Onboarding & Beta Launch

**Week 9-10: LLM-Powered Onboarding**
- [ ] Build LLM integration service
  - OpenAI GPT-4o-mini API (stateless calls)
  - Prompt engineering for decision parsing
  - Fallback to template-based onboarding if API fails
- [ ] Implement "Quick Start" onboarding flow
  - Natural language input UI
  - LLM parsing → structured decision preview
  - User review/edit interface
- [ ] Add error handling (API rate limits, network failures)
- [ ] Optimize for cost (<$0.005 per onboarding)
- [ ] A/B test: LLM onboarding vs. manual entry (conversion rates)

**Week 11: Polish & Testing**
- [ ] UI/UX refinements based on dogfooding feedback
- [ ] Performance optimization (app launch <1.5s, insight generation <2s)
- [ ] Comprehensive testing:
  - Unit tests (80%+ code coverage)
  - Integration tests (end-to-end flows)
  - Device testing (iOS 15+, Android 10+)
- [ ] Privacy audit (ensure no data leaks, GDPR compliance)
- [ ] Prepare analytics dashboard for retention tracking

**Week 12: Closed Beta Launch**
- [ ] Recruit 50-100 beta users (target: decision-heavy professionals)
- [ ] TestFlight/Google Play Internal Testing distribution
- [ ] Set up support channel (Discord/Slack community)
- [ ] Begin 4-week retention tracking
- [ ] Weekly feedback surveys
- [ ] Monitor key metrics:
  - Day 1, Day 7, Day 14, Day 28 retention
  - Average outcomes logged per user
  - Insight engagement rate (% of insights read)
  - Streak maintenance rate

**Milestone 3 (End of Month 3 - GO/NO-GO DECISION):**
- ✅ Closed beta launched with 50-100 users
- ✅ **Critical Metric:** >30% 4-week retention achieved
  - **GO:** Proceed to Phase 2 (QLBN integration)
  - **NO-GO:** Pivot or halt (engagement model failed)
- ✅ Qualitative feedback validates Insight-Driven Loop value
- ✅ LLM onboarding shows >60% conversion (vs. <30% for manual entry)

---

## 5. Success Metrics & KPIs

### Primary Metric (Go/No-Go)
- **4-Week Retention:** >30% of beta users active after 28 days

### Supporting Metrics
| Metric | Target (Month 3) | Measurement Method |
|--------|------------------|-------------------|
| **Day 1 Retention** | >70% | Users who return day after signup |
| **Average Outcomes Logged** | ≥3 per user | Median count per active user |
| **Insight Engagement Rate** | >50% | % of generated insights that are read |
| **LLM Onboarding Conversion** | >60% | % of users completing decision setup via LLM |
| **Streak Maintenance (7-day)** | >25% | % of users maintaining a 7-day streak |
| **Decision Accuracy Improvement** | Measurable trend | Month-over-month accuracy score change |
| **NPS (Net Promoter Score)** | >40 | Beta user survey (Weeks 2 & 4) |

### Analytics Events (Privacy-Preserving)
- `decision_created` (source: llm | manual)
- `outcome_logged` (decision_age_days, satisfaction_delta)
- `insight_generated` (type, is_read)
- `streak_achieved` (length)
- `badge_unlocked` (badge_name)
- `user_retained_d1`, `user_retained_d7`, `user_retained_d14`, `user_retained_d28`

---

## 6. Risk Register & Mitigation

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **LLM API costs spiral** | Medium | Medium | Rate limiting, cheaper model (Haiku), fallback to manual entry |
| **Insight generation feels "gimmicky"** | Medium | **CRITICAL** | A/B test insight types, user feedback loops, quality over quantity |
| **Users don't log outcomes** | **HIGH** | **CRITICAL** | Reduce friction (<30s), compelling notifications, streak incentives |
| **Cold start: Users need >5 outcomes for insights** | Medium | High | Provide "generic" insights early (e.g., "Most people overestimate time by 20%") |
| **Platform fragmentation (iOS vs. Android bugs)** | Medium | Medium | Prioritize one platform for beta (iOS), Android in Phase 2 |
| **Privacy concerns block adoption** | Low | Medium | Clear privacy policy, local-first messaging, audit by third party |
| **Beta user recruitment fails** | Medium | High | Leverage personal networks, Reddit (r/DecisionMaking), ProductHunt soft launch |

---

## 7. Phase 1 → Phase 2 Transition Criteria

**Proceed to Phase 2 (QLBN Integration) ONLY IF:**
1. ✅ **>30% 4-week retention achieved** (non-negotiable)
2. ✅ Insight-Driven Loop validated (>50% insight engagement)
3. ✅ LLM onboarding proves valuable (>60% conversion vs. manual)
4. ✅ Technical foundation stable (no critical bugs, <1% crash rate)
5. ✅ User feedback indicates demand for "deeper insights" (qualitative signal for QLBN value)

**If No-Go:**
- Pivot: Iterate on engagement mechanisms (new insight types, social features)
- Or: Strategic halt (acknowledge psychological moat is unsolvable with current approach)

---

## 8. Open Questions & Decisions Needed

1. **Platform Priority:** iOS-first or simultaneous iOS/Android launch?
   - **Recommendation:** iOS-first for faster iteration, Android in Month 4
2. **LLM Provider:** OpenAI (GPT-4o-mini) vs. Anthropic (Claude Haiku)?
   - **Recommendation:** Anthropic Haiku (lower cost, better instruction-following)
3. **Beta User Profile:** Target decision-heavy professionals or general consumers?
   - **Recommendation:** Professionals (managers, consultants) for higher engagement baseline
4. **Monetization in Phase 1?** Free-only or test $4.99/month "Pro" tier?
   - **Recommendation:** Free-only; monetization testing in Phase 2

---

## 9. Conclusion

Phase 1 is a **disciplined, high-stakes experiment** designed to validate the single most critical assumption: that the Insight-Driven Loop can solve the outcome-logging chasm that destroyed all previous decision apps. Success unlocks a path to a category-defining enterprise platform. Failure provides a clear, early signal to pivot or halt before significant capital is wasted.

**The roadmap is intentionally front-loaded with risk**: if users won't log outcomes even with instant insights and gamification, no amount of quantum-inspired AI will save the product. This is a feature, not a bug, of the strategic plan.

**Next Step:** Review this roadmap, finalize technology choices, and initialize the development environment to begin Month 1, Week 1 execution.

---

**Document Status:** DRAFT v1.0 - Awaiting Stakeholder Review
