# Week 9-10 UI Implementation Plan

**Objective:** Build all core UI screens for Phase 1 MVP beta launch

**Strategic Priority:** Focus on screens that enable the Insight-Driven Loop (THE MOAT)

---

## 📋 Implementation Phases

### Phase A: Foundation (Days 1-2)
**Goal:** Set up navigation and shared components

1. **React Navigation Setup**
   - Bottom tab navigator (Home, Insights, Profile)
   - Stack navigators for each tab
   - Navigation types and params
   - Deep linking configuration

2. **Shared UI Components**
   - Button (primary, secondary, text)
   - Card (with shadow, border variants)
   - Input (text, number, slider)
   - Badge (for streaks, unread counts)
   - EmptyState (for empty lists)
   - LoadingSpinner
   - Theme colors and typography

3. **Navigation Structure**
   ```
   App
   ├── TabNavigator
   │   ├── HomeStack
   │   │   ├── HomeScreen (Decision List)
   │   │   ├── DecisionDetailScreen
   │   │   ├── AddDecisionScreen (Manual entry)
   │   │   └── EditDecisionScreen
   │   ├── InsightsStack
   │   │   ├── InsightFeedScreen (THE MOAT UI)
   │   │   └── InsightDetailScreen
   │   └── ProfileStack
   │       ├── ProfileScreen (Stats & Badges)
   │       └── SettingsScreen
   └── Modal Stack
       ├── OnboardingFlow (First-time user)
       ├── OutcomeLoggingScreen (THE CRITICAL UX)
       └── ScoringScreen (Rate options on factors)
   ```

### Phase B: Critical Path (Days 3-5)
**Goal:** Implement the Insight-Driven Loop UX

4. **Outcome Logging Screen** (THE CRITICAL UX)
   - **Priority: HIGHEST** - This is what makes retention work
   - Select decision from list
   - Actual satisfaction slider (0-10)
   - Surprise factor slider (-3 to +3)
   - Optional notes (text area)
   - Submit button → Triggers insight generation
   - Loading state with "Analyzing your decision..." message
   - Success state with "X new insights!" → Navigate to Insights
   - Integration with InsightOrchestrator
   - Integration with GamificationService (streak updates)

5. **Insight Feed Screen** (THE MOAT UI)
   - **Priority: HIGHEST** - This is the reward for outcome logging
   - List of insights sorted by priority
   - Insight cards with:
     * Type icon (📊 correlation, ⚠️ bias, 🎯 accuracy, 🏆 achievement)
     * Title (bold, attention-grabbing)
     * Description (2-3 lines)
     * Priority indicator (color-coded)
     * Read/unread state
     * Timestamp ("2 hours ago")
   - Unread badge count in tab bar
   - Pull-to-refresh
   - Empty state: "Log an outcome to unlock insights!"
   - Tap to expand/mark as read
   - Swipe to dismiss
   - Filter by type (All, Correlations, Biases, Accuracy, Achievements)

6. **Home Screen** (Decision List)
   - **Priority: HIGH** - Entry point for app
   - List of active decisions
   - Decision cards showing:
     * Title
     * Status (Active, Awaiting outcome, Completed)
     * Days since created
     * "Log outcome" button if completed but not logged
   - Floating action button: "New Decision"
   - Empty state: "Start by creating your first decision"
   - Pull-to-refresh
   - Tap to view details

### Phase C: Onboarding & Creation (Days 6-7)
**Goal:** Enable decision creation via LLM

7. **Onboarding Flow** (Modal)
   - **WelcomeScreen:**
     * App logo/name
     * Value proposition (3 bullet points)
     * "Get Started" button
   - **NaturalLanguageInputScreen:**
     * Text input with placeholder: "Describe your decision..."
     * Examples: "Should I accept the job offer?" etc.
     * Character count (min 10)
     * "Parse Decision" button
     * Loading state with LLM animation
     * Error handling (rate limits, network errors)
   - **ReviewDecisionScreen:**
     * Shows parsed decision (title, options, factors)
     * Edit buttons for each section
     * Warning messages if any (truncation, normalization)
     * "Looks good!" button → Save to database
     * "Try again" button → Go back
   - **ConfirmationScreen:**
     * Success message
     * "What's next:" guide
     * "Start using app" button → Navigate to Home

8. **User Profile Screen**
   - **Priority: MEDIUM** - Gamification display
   - User stats card:
     * Current streak (🔥 X days)
     * Longest streak
     * Total decisions
     * Outcomes logged
     * Accuracy score
   - Badges section:
     * Earned badges (colored, with date)
     * Locked badges (greyscale, with unlock condition)
   - Settings button
   - "How it works" button (tutorial)

### Phase D: Decision Management (Days 8-9)
**Goal:** Full decision modeling workflow

9. **Decision Detail Screen**
   - Decision title and status
   - Options list with utility scores
   - Factors list with weights
   - "Get Recommendation" button → Calls MAUTEngine
   - Recommendation display:
     * Top option with confidence %
     * Utility breakdown chart
     * Alternative options
   - "Edit Decision" button
   - "Delete Decision" button
   - "Mark as Decided" button → Select winning option
   - "Log Outcome" button (if decided)

10. **Add/Edit Decision Screen**
    - Manual decision entry (fallback for LLM)
    - Decision title input
    - Add Options section (min 2, max 10)
    - Add Factors section (min 1, max 10)
    - Weight adjustment (sliders, must sum to 1.0)
    - Validation and error messages
    - "Save" button
    - "Use AI to help" button → Navigate to NL input

11. **Scoring Screen** (Modal)
    - Rate all options on all factors
    - Grid layout: Options (rows) × Factors (columns)
    - 1-5 star rating for each cell
    - Progress indicator (X of Y completed)
    - "Calculate Recommendation" button
    - Integration with MAUTEngine

### Phase E: Polish & Testing (Day 10)
**Goal:** Bug fixes, UX refinement, integration testing

12. **Final Integration**
    - Test complete flow: Onboarding → Create → Score → Decide → Log Outcome → View Insights
    - Test gamification: Streaks, badges, notifications
    - Test LLM integration: NL input, parsing, error handling
    - Performance testing: <2s insight generation
    - Accessibility testing: Screen reader, font scaling
    - Error state testing: Network errors, empty states

13. **UX Polish**
    - Loading states everywhere
    - Error states with retry buttons
    - Success animations (confetti for milestones?)
    - Haptic feedback for important actions
    - Toast messages for confirmations
    - Consistent spacing and typography
    - Dark mode support (optional)

---

## 🎨 Design Principles

### Visual Design
- **Clean & Minimal:** White/light grey background, card-based layout
- **Color Psychology:**
  - Primary: Blue (#007AFF) - Trust, decisions
  - Success: Green (#34C759) - Positive outcomes, achievements
  - Warning: Orange (#FF9500) - Biases, attention
  - Error: Red (#FF3B30) - Errors, negative
  - Accent: Purple (#AF52DE) - Insights, premium feel
- **Typography:**
  - Headings: System Bold, 20-28pt
  - Body: System Regular, 14-16pt
  - Labels: System Medium, 12-14pt
- **Spacing:** 8px grid (8, 16, 24, 32, 40)
- **Shadows:** Subtle elevation for cards and modals

### Interaction Design
- **Immediate Feedback:** Every action gets instant visual feedback
- **Clear CTAs:** Primary actions use buttons, secondary use text links
- **Progressive Disclosure:** Don't overwhelm, reveal complexity gradually
- **Forgiving UX:** Undo options, confirmation dialogs for destructive actions
- **Delight:** Subtle animations, celebratory moments (badges, streaks)

### Information Architecture
- **Shallow Navigation:** Max 2-3 taps to any feature
- **Context-Aware:** Show relevant actions based on decision state
- **Persistent Navigation:** Bottom tabs always visible
- **Modal for Focus:** Outcome logging and scoring demand full attention

---

## 🔧 Technical Implementation

### State Management
- **WatermelonDB Observables:** Reactive queries for lists
- **React State:** Form inputs, UI state
- **React Context:** (If needed) Global UI state
- **No Redux:** Keep it simple for Phase 1

### Performance Optimizations
- **FlatList:** For long lists (decisions, insights)
- **Memoization:** React.memo for expensive components
- **Lazy Loading:** Load images/data on demand
- **Debouncing:** Search inputs, LLM calls

### Error Handling
- **Try-Catch:** Wrap all async operations
- **User-Friendly Messages:** No technical jargon
- **Retry Mechanisms:** Network errors get retry buttons
- **Fallback UI:** Graceful degradation if services fail

---

## 📊 Success Metrics (Phase 1 Go/No-Go)

### Critical Metrics (Week 12 Evaluation)
1. **4-Week Retention:** >30% (THE GO/NO-GO METRIC)
2. **Average Outcomes Logged:** ≥3 per user
3. **Insight Engagement Rate:** >50% of insights read
4. **LLM Onboarding Conversion:** >60% complete first decision

### Leading Indicators (Week 11 Beta)
1. **Day 0 Churn:** <40% (LLM onboarding impact)
2. **Week 1 Retention:** >60% (Gamification impact)
3. **Outcome Logging Rate:** >50% of decisions get outcomes
4. **Insight Generation:** <2s average (Performance)
5. **App Crashes:** <1% (Stability)

---

## 🚀 Implementation Strategy

### Day-by-Day Plan

**Days 1-2: Foundation**
- Set up React Navigation
- Build shared components library
- Create theme/style system
- Test navigation flow

**Days 3-4: Critical Path**
- Outcome Logging screen (full implementation)
- Insight Feed screen (full implementation)
- Test Insight-Driven Loop end-to-end

**Day 5: Home & Profile**
- Home screen (decision list)
- User Profile screen (stats & badges)
- Test gamification display

**Days 6-7: Onboarding**
- Welcome screen
- NL input screen with LLM integration
- Review/edit parsed decision screen
- Confirmation screen
- Test complete onboarding flow

**Days 8-9: Decision Management**
- Decision detail screen
- Add/edit decision screen
- Scoring screen
- Test MAUT recommendation

**Day 10: Polish & Testing**
- Bug fixes from testing
- UX refinement
- Performance optimization
- Final integration testing
- Prepare for Week 11 testing phase

---

## 🎯 Risk Mitigation

### High-Risk Areas
1. **Outcome Logging UX:** If too complex, users won't log outcomes
   - Mitigation: Keep it dead simple (2 sliders + optional notes)
   - Test: User testing with 5-10 beta testers

2. **Insight Feed Engagement:** If insights aren't compelling, loop breaks
   - Mitigation: Prioritize high-value insights, hide low-priority
   - Test: Track read rate, adjust priorities

3. **Onboarding Friction:** If LLM parsing fails, users abandon
   - Mitigation: Clear error messages, manual entry fallback
   - Test: Monitor LLM success rate, optimize prompts

4. **Performance:** If insight generation >2s, perceived as slow
   - Mitigation: Loading states, "Analyzing..." message, progress indicator
   - Test: Performance profiling on real devices

---

## 📝 Definition of Done

### Each Screen Must Have:
- ✅ TypeScript types for all props and state
- ✅ Error boundaries
- ✅ Loading states
- ✅ Empty states
- ✅ Error states with retry
- ✅ Accessibility labels
- ✅ Integration with backend services
- ✅ Navigation properly configured
- ✅ Tested on iOS and Android (simulator)

### Phase 1 MVP Complete When:
- ✅ All 11 screens implemented
- ✅ Navigation works end-to-end
- ✅ Insight-Driven Loop functional
- ✅ Gamification displays correctly
- ✅ LLM onboarding works (with fallback)
- ✅ No critical bugs
- ✅ Performance <2s for insights
- ✅ Ready for TestFlight/Play Console upload

---

## 🎓 Lessons from Backend Implementation

### What Worked Well:
- Modular architecture (services as independent units)
- TypeScript strict mode (caught many bugs early)
- Comprehensive error handling (graceful degradation)
- Performance budgets (<2s for insights)

### Apply to UI:
- **Component Library:** Build reusable UI components first
- **Type Safety:** Define navigation params, screen props
- **Error Handling:** Every async operation wrapped in try-catch
- **Performance:** Profile on real devices, not just simulator
- **Testing:** Test critical paths (outcome logging → insights)

---

**Status:** Ready to implement
**Estimated Effort:** 10 days (Week 9-10)
**Next Action:** Set up React Navigation structure
