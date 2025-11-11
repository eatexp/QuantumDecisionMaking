# Setup and Deployment Guide
## Quantum Decision Lab - Phase 1 MVP

**Version:** 1.0
**Last Updated:** 2025-11-11
**For:** Development Team

---

## 📋 Prerequisites

### Required Software
- **Node.js**: ≥18.0.0
- **npm**: ≥9.0.0
- **Xcode**: Latest version (for iOS development)
- **Android Studio**: Latest version (for Android development)
- **Cloudflare Account**: Free tier sufficient
- **Anthropic API Key**: Claude Haiku access

### Required Accounts
- [ ] Apple Developer Program ($99/year) - for iOS deployment
- [ ] Google Play Console ($25 one-time) - for Android deployment
- [ ] Anthropic API account - for LLM integration
- [ ] Cloudflare account - for Worker deployment

---

## 🚀 Part 1: React Native Mobile App Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/QuantumDecisionMaking.git
cd QuantumDecisionMaking
```

### Step 2: Install Mobile Dependencies

```bash
cd mobile
npm install

# iOS specific (macOS only)
cd ios
pod install
cd ..
```

**Expected Duration:** 5-10 minutes

### Step 3: Configure Environment Variables

Create `.env` file in `mobile/` directory:

```bash
# mobile/.env
ANTHROPIC_API_KEY=sk-ant-your-key-here
LLM_GATEWAY_URL=https://your-worker.your-subdomain.workers.dev/parse-decision

# Analytics (optional)
POSTHOG_API_KEY=phc_your_key_here
SENTRY_DSN=https://your-sentry-dsn-here

# Feature flags
ENABLE_LLM_ONBOARDING=true
ENABLE_ANALYTICS=true
```

**Security:** Add `.env` to `.gitignore` (already included)

### Step 4: Configure Encryption Keys

The app generates encryption keys on first launch, but you can pre-configure for testing:

```bash
# No action needed - keys are generated automatically on device
# For testing, use TestFlight/internal builds
```

### Step 5: Run Development Build

**iOS:**
```bash
npm run ios
# Or specify device: npx react-native run-ios --device "iPhone 14 Pro"
```

**Android:**
```bash
npm run android
# Or specify device: npx react-native run-android --deviceId emulator-5554
```

**Expected Outcome:** App launches on simulator/emulator with encrypted database initialized

---

## ⚙️ Part 2: Cloudflare Worker Setup (LLM Gateway)

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Step 2: Create KV Namespace

```bash
cd cloudflare-worker

# Create KV namespace for production
wrangler kv:namespace create "LLM_CACHE"

# Create KV namespace for development
wrangler kv:namespace create "LLM_CACHE" --preview
```

**Output:** Copy the namespace IDs to `wrangler.toml`

```toml
[[kv_namespaces]]
binding = "KV"
id = "abc123..." # Production namespace ID
preview_id = "def456..." # Preview namespace ID
```

### Step 3: Set Secrets

```bash
# Set Anthropic API key (secure secret)
wrangler secret put ANTHROPIC_API_KEY
# Paste your API key when prompted: sk-ant-...

# Set daily budget (optional, defaults to $10)
wrangler secret put DAILY_BUDGET_USD
# Enter: 10.00
```

### Step 4: Deploy Worker

```bash
# Deploy to production
wrangler deploy

# Or deploy to development environment
wrangler deploy --env development
```

**Expected Output:**
```
✨ Success! Uploaded worker.
🌍 Published quantum-decisions-llm-gateway
   https://quantum-decisions-llm-gateway.YOUR-SUBDOMAIN.workers.dev
```

### Step 5: Test Endpoint

```bash
curl -X POST https://your-worker.workers.dev/parse-decision \
  -H "Content-Type: application/json" \
  -d '{
    "description": "I'\''m deciding between two job offers. Company A pays $120k but has a 90-minute commute. Company B pays $100k but offers remote work.",
    "anonymous_user_id": "test-user-123"
  }'
```

**Expected Response:**
```json
{
  "decision": {
    "title": "Choose Job Offer",
    "options": [
      {"name": "Company A"},
      {"name": "Company B"}
    ],
    "factors": [
      {"name": "Salary", "weight": 0.35},
      {"name": "Commute Time", "weight": 0.25},
      {"name": "Work Flexibility", "weight": 0.20},
      {"name": "Career Growth", "weight": 0.15},
      {"name": "Benefits", "weight": 0.05}
    ]
  },
  "source": "llm",
  "cost_estimate": 0.0002
}
```

### Step 6: Update Mobile App Config

Update `.env` in mobile app with your Worker URL:

```bash
# mobile/.env
LLM_GATEWAY_URL=https://quantum-decisions-llm-gateway.YOUR-SUBDOMAIN.workers.dev/parse-decision
```

---

## 🧪 Part 3: Testing

### Unit Tests

```bash
cd mobile
npm run test

# With coverage
npm run test:coverage
```

**Target:** ≥80% coverage for services

### Integration Tests

```bash
# Run integration test suite
npm run test -- --testPathPattern=integration
```

### Manual Testing Checklist

- [ ] **Database Encryption**
  - [ ] Verify DB file is encrypted (not plaintext)
  - [ ] Test encryption key generation
  - [ ] Test data wipe (GDPR compliance)

- [ ] **LLM Onboarding**
  - [ ] Test valid decision description
  - [ ] Test rate limiting (6th call fails)
  - [ ] Test fallback to manual entry

- [ ] **Insight-Driven Loop**
  - [ ] Log 5+ outcomes
  - [ ] Verify insights generate within 2 seconds
  - [ ] Check insight quality (correlation makes sense)

- [ ] **Performance**
  - [ ] App launch <1.5s (cold start)
  - [ ] Outcome log → insight <2s
  - [ ] Database queries <50ms

---

## 📦 Part 4: Build for TestFlight/Play Console

### iOS (TestFlight)

#### 1. Configure Signing

In Xcode:
1. Open `mobile/ios/QuantumDecisionLab.xcworkspace`
2. Select project → Signing & Capabilities
3. Set Team and Bundle Identifier
4. Enable "Automatically manage signing"

#### 2. Archive Build

```bash
cd mobile/ios

# Build archive
xcodebuild -workspace QuantumDecisionLab.xcworkspace \
  -scheme QuantumDecisionLab \
  -configuration Release \
  -archivePath build/QuantumDecisionLab.xcarchive \
  archive

# Export IPA
xcodebuild -exportArchive \
  -archivePath build/QuantumDecisionLab.xcarchive \
  -exportPath build \
  -exportOptionsPlist ExportOptions.plist
```

#### 3. Upload to TestFlight

Using Fastlane (recommended):

```bash
# Install Fastlane
gem install fastlane

# Initialize Fastlane
cd mobile/ios
fastlane init

# Create Fastfile lane
fastlane beta
```

Or manually via Xcode:
1. Product → Archive
2. Distribute App → TestFlight
3. Upload

#### 4. Add Testers

1. Go to App Store Connect → TestFlight
2. Add Internal Testers (up to 100)
3. Create External Tester Groups (for public beta)

---

### Android (Google Play Internal Testing)

#### 1. Generate Keystore

```bash
cd mobile/android/app

keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore quantum-decisions.keystore \
  -alias quantum-decisions \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Store password securely** (e.g., in password manager)

#### 2. Configure Gradle

Edit `mobile/android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=quantum-decisions.keystore
MYAPP_UPLOAD_KEY_ALIAS=quantum-decisions
MYAPP_UPLOAD_STORE_PASSWORD=your-password-here
MYAPP_UPLOAD_KEY_PASSWORD=your-password-here
```

#### 3. Build AAB

```bash
cd mobile/android

./gradlew bundleRelease
```

**Output:** `app/build/outputs/bundle/release/app-release.aab`

#### 4. Upload to Play Console

1. Go to Google Play Console → Create App
2. Internal Testing → Create Release
3. Upload `app-release.aab`
4. Add testers (email list or Google Group)

---

## 🔒 Part 5: Security Checklist

Before beta launch:

- [ ] **Encryption Verified**
  - [ ] SQLCipher working (run unit test)
  - [ ] Keychain integration tested
  - [ ] No plaintext data in DB file

- [ ] **API Security**
  - [ ] Anthropic API key is secret (not in code)
  - [ ] LLM Gateway has rate limiting
  - [ ] CORS properly configured

- [ ] **Privacy Compliance**
  - [ ] Privacy policy created
  - [ ] Analytics opt-out available
  - [ ] Data export implemented
  - [ ] Data wipe tested

- [ ] **App Store Review**
  - [ ] Privacy labels completed (iOS)
  - [ ] Data Safety form filled (Android)
  - [ ] No tracking without consent

---

## 📊 Part 6: Analytics & Monitoring

### PostHog Setup (Optional)

```bash
# Self-hosted (Docker)
docker run -d \
  --name posthog \
  -p 8000:8000 \
  -e SECRET_KEY=your-secret-key \
  posthog/posthog:latest

# Or use PostHog Cloud (free tier)
# Get API key from app.posthog.com
```

Add to mobile `.env`:
```
POSTHOG_API_KEY=phc_your_key_here
POSTHOG_HOST=https://app.posthog.com # or self-hosted URL
```

### Sentry Setup (Crash Reporting)

```bash
cd mobile
npm install @sentry/react-native

# Initialize
npx sentry-wizard -i reactNative -p ios android
```

Add DSN to `.env`:
```
SENTRY_DSN=https://your-sentry-dsn-here
```

---

## 🚀 Part 7: Beta Launch Checklist

### Week Before Launch

- [ ] **Final Testing**
  - [ ] All critical paths tested (onboarding, logging, insights)
  - [ ] Tested on low-end devices (iPhone SE, Android mid-range)
  - [ ] Load tested (50 outcomes, 10 decisions)

- [ ] **Documentation**
  - [ ] Beta testing guide created (PDF)
  - [ ] Feedback form ready (Google Forms/Typeform)
  - [ ] Support channel set up (Discord/Slack)

- [ ] **Recruitment**
  - [ ] 50-100 beta testers recruited
  - [ ] Invitation emails drafted
  - [ ] Onboarding email sequence ready

### Launch Day

- [ ] **Deploy**
  - [ ] Mobile app uploaded to TestFlight/Play Console
  - [ ] Cloudflare Worker deployed and tested
  - [ ] Analytics dashboards set up

- [ ] **Invite Testers**
  - [ ] Send TestFlight/Play Console invites
  - [ ] Share beta testing guide
  - [ ] Monitor first installations

- [ ] **Monitor**
  - [ ] Watch Sentry for crashes
  - [ ] Check PostHog for retention metrics
  - [ ] Respond to feedback in support channel

### First Week

- [ ] **Collect Data**
  - [ ] Daily active users
  - [ ] Outcome logging rate
  - [ ] Insight engagement rate
  - [ ] Crash rate

- [ ] **Iterate**
  - [ ] Fix critical bugs within 24h
  - [ ] Deploy hotfixes as needed
  - [ ] Weekly feedback review

---

## 📈 Part 8: Success Metrics

### Week 1 Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Installations | 50+ | ___ |
| Day 1 Retention | >70% | ___ |
| Avg Outcomes Logged | ≥1 | ___ |
| Crash Rate | <1% | ___ |

### Week 4 Targets (GO/NO-GO)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **4-Week Retention** | **>30%** | ___ | 🟡 Pending |
| Avg Outcomes Logged | ≥3 | ___ | 🟡 Pending |
| Insight Engagement | >50% | ___ | 🟡 Pending |
| LLM Onboarding Conversion | >60% | ___ | 🟡 Pending |

**GO/NO-GO Decision:** If 4-week retention >30% → Proceed to Phase 2 (QLBN integration)

---

## 🆘 Troubleshooting

### Common Issues

**1. iOS Build Fails: "SQLCipher not found"**
```bash
cd mobile/ios
pod deintegrate
pod install
```

**2. Android Build Fails: "Duplicate class"**
```bash
cd mobile/android
./gradlew clean
./gradlew bundleRelease
```

**3. LLM Gateway Returns 429 (Rate Limit)**
- Check KV namespace is correctly configured
- Verify user ID is being sent
- Wait 24 hours for rate limit reset

**4. Insights Not Generating**
- Check outcome count (need ≥5 for correlation)
- Verify database has factor data
- Check console logs for errors
- Fallback insight should always appear

**5. Database Encryption Error**
- Ensure react-native-keychain is linked
- Test on real device (not simulator)
- Check keychain permissions in Info.plist

---

## 📞 Support

- **Documentation:** See `/docs` folder
- **GitHub Issues:** https://github.com/YOUR_REPO/issues
- **Team Chat:** [Slack/Discord link]

---

## ✅ Post-Launch Tasks

After successful beta launch:

- [ ] Collect user feedback (surveys, interviews)
- [ ] Analyze retention cohorts (PostHog)
- [ ] Identify top feature requests
- [ ] Plan Phase 2 (QLBN integration)
- [ ] Prepare investor update (if applicable)

---

**Document Status:** READY FOR USE ✅

**Last Verified:** 2025-11-11

**Next Update:** After Week 4 metrics collection
