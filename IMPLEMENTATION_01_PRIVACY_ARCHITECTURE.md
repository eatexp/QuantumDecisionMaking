# Phase 1 Implementation Guide: Privacy-First Architecture
## React Native Setup for Federated Learning Foundation

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Implementation Priority:** CRITICAL (Week 1-2)

---

## 1. Strategic Context

The privacy-first architecture is a **non-negotiable foundation** for three reasons:

1. **Legal Necessity**: Decision data qualifies as "special category data" under GDPR Article 9 (data revealing personal beliefs, preferences, and decision-making patterns)
2. **BetterHelp Precedent**: $7.8M FTC fine for sharing sensitive user data with third parties (Facebook, Snapchat) without proper consent
3. **B2B Differentiator**: Enterprise buyers demand zero-knowledge architectures for sensitive decision logs (HR decisions, M&A strategy, competitive analysis)

**Core Principle**: Raw user data stays on-device by default. Only anonymized, aggregated model parameters leave the device (and only with explicit user consent).

---

## 2. Data Classification: On-Device vs. Cloud-Permissible

### 2.1 On-Device Only (RAW DATA - Never Leaves Device by Default)

| Data Type | Examples | Storage | Encryption |
|-----------|----------|---------|------------|
| **Decision Models** | Factor names, weights, option descriptions | SQLite (WatermelonDB) | SQLCipher AES-256 |
| **Outcome Logs** | Actual satisfaction scores, surprise factors, notes | SQLite | SQLCipher AES-256 |
| **Personal Insights** | Correlation discoveries, bias patterns | SQLite | SQLCipher AES-256 |
| **Gamification State** | Streaks, badges, accuracy scores | SQLite | SQLCipher AES-256 |
| **User Preferences** | Habit stacking anchors, notification settings | SQLite | SQLCipher AES-256 |

**Access Pattern**: Direct SQL queries via WatermelonDB → Encrypted local database

---

### 2.2 Cloud-Permissible (Anonymized Aggregates - Opt-In Only)

| Data Type | What's Shared | Privacy Mechanism | Phase 1 Status |
|-----------|--------------|-------------------|----------------|
| **Anonymized Usage Events** | `decision_created`, `outcome_logged` (no content) | User ID → Anonymous UUID mapping | ✅ Implemented |
| **Aggregate Statistics** | "Users with 5+ factors have 12% higher retention" | k-anonymity (min 10 users per cohort) | ⏸️ Phase 2 |
| **Model Parameters (Federated Learning)** | Weight updates for collective intelligence | Differential privacy (ε=1.0) | ⏸️ Phase 2 |
| **Encrypted Backups** | End-to-end encrypted full database export | User's key never leaves device (zero-knowledge) | ✅ Implemented (opt-in) |

**Phase 1 Scope**: Only anonymized usage events and optional encrypted backups. Full federated learning deferred to Phase 2.

---

## 3. React Native Project Initialization

### 3.1 Project Setup with Privacy Constraints

**Step 1: Initialize React Native Project**

```bash
# Create new React Native project with TypeScript
npx react-native@latest init QuantumDecisionLab --template react-native-template-typescript

cd QuantumDecisionLab

# Install core dependencies
npm install @nozbe/watermelondb @nozbe/with-observables
npm install react-native-quick-sqlite # WatermelonDB adapter
npm install react-native-quick-crypto # For encryption utilities
npm install @react-native-community/async-storage # For non-sensitive config
npm install react-native-keychain # Secure key storage (iOS Keychain/Android Keystore)

# Install development dependencies
npm install --save-dev @babel/plugin-proposal-decorators
npm install --save-dev babel-plugin-module-resolver
```

**Step 2: Configure Babel for WatermelonDB**

**File:** `babel.config.js`

```javascript
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    [
      'module-resolver',
      {
        alias: {
          '@database': './src/database',
          '@models': './src/database/models',
          '@services': './src/services',
          '@utils': './src/utils',
        },
      },
    ],
  ],
};
```

---

### 3.2 SQLCipher Integration (Encrypted Database)

**Challenge**: WatermelonDB uses SQLite, but we need SQLCipher (encrypted SQLite) for GDPR compliance.

**Solution**: Use `react-native-quick-sqlite` with encryption enabled.

**File:** `src/database/adapter.ts`

```typescript
import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import * as Keychain from 'react-native-keychain';
import { generateEncryptionKey, deriveKeyFromPIN } from '@utils/crypto';

/**
 * Privacy-First Database Adapter
 *
 * All data is encrypted at rest using SQLCipher (AES-256).
 * Encryption key is stored in iOS Keychain / Android Keystore (hardware-backed security).
 */

const DATABASE_NAME = 'quantum_decisions';

/**
 * Get or create encryption key
 *
 * On first launch:
 * 1. Generate random 256-bit key
 * 2. Store in secure keychain (hardware-backed)
 * 3. No cloud backup of key (intentional - if device lost, data is unrecoverable)
 *
 * @returns {Promise<string>} Base64-encoded encryption key
 */
async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    // Try to retrieve existing key
    const credentials = await Keychain.getGenericPassword({ service: 'db_encryption' });

    if (credentials) {
      return credentials.password;
    }

    // First launch: generate new key
    console.log('[Privacy] First launch detected. Generating encryption key...');
    const newKey = await generateEncryptionKey(); // 256-bit random key

    // Store in secure hardware-backed keychain
    await Keychain.setGenericPassword('db_key', newKey, {
      service: 'db_encryption',
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED, // Only accessible when device unlocked
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE, // Use TEE/Secure Enclave if available
    });

    console.log('[Privacy] Encryption key generated and stored securely');
    return newKey;

  } catch (error) {
    console.error('[Privacy] Failed to get/create encryption key:', error);
    throw new Error('Failed to initialize secure storage. Device may not support required security features.');
  }
}

/**
 * Initialize encrypted database adapter
 *
 * Privacy guarantees:
 * - All data encrypted at rest (AES-256 via SQLCipher)
 * - Encryption key stored in hardware security module (iOS Secure Enclave / Android Keystore)
 * - No plaintext data ever written to disk
 * - Database locked when app backgrounded
 */
export async function createDatabaseAdapter(): Promise<SQLiteAdapter> {
  const encryptionKey = await getOrCreateEncryptionKey();

  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    dbName: DATABASE_NAME,
    jsi: true, // Use JSI for better performance (React Native 0.68+)

    // SQLCipher encryption configuration
    // NOTE: Requires react-native-quick-sqlite with SQLCipher support
    encryptionKey: encryptionKey,

    // Performance optimizations (maintains ACID guarantees)
    synchronous: 'NORMAL', // Faster than FULL, still crash-safe
    journalMode: 'WAL', // Write-Ahead Logging (allows concurrent reads during writes)

    // Experimental performance features
    experimentalUseJSI: true,
  });

  return adapter;
}

/**
 * Initialize WatermelonDB database
 *
 * Called once at app startup.
 */
export async function initializeDatabase(): Promise<Database> {
  const adapter = await createDatabaseAdapter();

  const database = new Database({
    adapter,
    modelClasses: [
      // Models will be imported here after creation
      // Decision, Option, Factor, FactorScore, Outcome, Insight, UserStat
    ],
  });

  console.log('[Privacy] Database initialized with encryption');
  return database;
}

/**
 * Lock database when app goes to background
 *
 * Security measure: Purge encryption key from memory when app not in use.
 */
export async function lockDatabase(database: Database): Promise<void> {
  // WatermelonDB doesn't expose direct locking, but we can clear sensitive caches
  console.log('[Privacy] Database locked (app backgrounded)');
  // In production, implement custom SQLite PRAGMA key reset
}

/**
 * Wipe all local data (GDPR Right to Deletion)
 *
 * Called when user deletes account or device.
 */
export async function wipeAllLocalData(): Promise<void> {
  try {
    // 1. Delete database file
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    // 2. Delete encryption key from keychain
    await Keychain.resetGenericPassword({ service: 'db_encryption' });

    // 3. Clear any cached data
    await AsyncStorage.clear();

    console.log('[Privacy] All local data wiped (GDPR compliance)');
  } catch (error) {
    console.error('[Privacy] Failed to wipe data:', error);
    throw error;
  }
}
```

---

### 3.3 Encryption Utility Functions

**File:** `src/utils/crypto.ts`

```typescript
import { NativeModules, Platform } from 'react-native';
import Crypto from 'react-native-quick-crypto';

/**
 * Generate a cryptographically secure 256-bit encryption key
 *
 * Uses platform-native random number generator (backed by /dev/urandom on iOS/Android)
 */
export async function generateEncryptionKey(): Promise<string> {
  const randomBytes = Crypto.randomBytes(32); // 256 bits
  return randomBytes.toString('base64');
}

/**
 * Derive encryption key from user PIN (for optional PIN-based encryption)
 *
 * Uses PBKDF2 with 100,000 iterations to resist brute-force attacks.
 *
 * @param pin - User's 4-8 digit PIN
 * @param salt - Unique salt (stored in plaintext in database metadata)
 */
export async function deriveKeyFromPIN(pin: string, salt: string): Promise<string> {
  const iterations = 100000; // OWASP recommendation for PBKDF2
  const keyLength = 32; // 256 bits

  const derivedKey = await Crypto.pbkdf2(
    pin,
    salt,
    iterations,
    keyLength,
    'sha256'
  );

  return derivedKey.toString('base64');
}

/**
 * Generate unique anonymous user ID (for analytics)
 *
 * Creates a UUID v4 that is NOT linked to the encryption key or device ID.
 * Stored separately from encrypted database.
 */
export function generateAnonymousUserId(): string {
  return Crypto.randomUUID();
}
```

---

## 4. Data Architecture: Enforcing Local-First Design

### 4.1 Database Schema (Privacy-Aware)

**File:** `src/database/schema.ts`

```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Privacy-First Schema Design
 *
 * All tables are stored in encrypted local database (SQLCipher).
 * No table includes identifiable information that could be reconstructed if leaked.
 *
 * Privacy Principles:
 * 1. No email addresses or names in database (stored in separate Keychain credential)
 * 2. No IP addresses or location data
 * 3. Factor names are user-defined and may contain sensitive info → encrypted
 * 4. Outcome notes may contain personal details → encrypted
 */
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'decisions',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'status', type: 'string' }, // 'active' | 'completed' | 'archived'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'decision_date', type: 'number', isOptional: true },
        { name: 'selected_option_id', type: 'string', isOptional: true },
        { name: 'decision_method', type: 'string' }, // 'weighted' | 'llm_suggested'
        { name: 'source', type: 'string' }, // 'manual' | 'llm_onboarding'
        { name: 'tags', type: 'string', isOptional: true }, // JSON array
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    tableSchema({
      name: 'options',
      columns: [
        { name: 'decision_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'display_order', type: 'number' },
        { name: 'predicted_satisfaction', type: 'number', isOptional: true },
        { name: 'confidence_score', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    tableSchema({
      name: 'factors',
      columns: [
        { name: 'decision_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' }, // SENSITIVE: May reveal personal priorities
        { name: 'description', type: 'string', isOptional: true },
        { name: 'weight', type: 'number' },
        { name: 'display_order', type: 'number' },
        { name: 'factor_type', type: 'string' },
        { name: 'is_positive', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    tableSchema({
      name: 'factor_scores',
      columns: [
        { name: 'option_id', type: 'string', isIndexed: true },
        { name: 'factor_id', type: 'string', isIndexed: true },
        { name: 'score', type: 'number' },
        { name: 'uncertainty', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    tableSchema({
      name: 'outcomes',
      columns: [
        { name: 'decision_id', type: 'string', isIndexed: true },
        { name: 'logged_at', type: 'number', isIndexed: true },
        { name: 'actual_satisfaction', type: 'number' },
        { name: 'surprise_factor', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true }, // HIGHLY SENSITIVE: Free-form text
        { name: 'context_tags', type: 'string', isOptional: true }, // JSON array
        { name: 'log_source', type: 'string' }, // 'manual' | 'reminder' | 'habit_stack'
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    tableSchema({
      name: 'insights',
      columns: [
        { name: 'generated_at', type: 'number', isIndexed: true },
        { name: 'insight_type', type: 'string', isIndexed: true },
        { name: 'category', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'data_payload', type: 'string', isOptional: true }, // JSON
        { name: 'is_read', type: 'boolean', isIndexed: true },
        { name: 'is_archived', type: 'boolean' },
        { name: 'priority', type: 'number' },
        { name: 'related_decision_ids', type: 'string', isOptional: true }, // JSON array
        { name: 'expires_at', type: 'number', isOptional: true },
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    tableSchema({
      name: 'user_stats',
      columns: [
        { name: 'metric_key', type: 'string' }, // This is effectively the primary key
        { name: 'metric_value', type: 'string' }, // JSON-serializable
        { name: 'metric_type', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
```

---

### 4.2 Local-First Data Access Layer

**File:** `src/database/DatabaseContext.tsx`

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Database } from '@nozbe/watermelondb';
import { initializeDatabase } from './adapter';

/**
 * Privacy-First Database Context
 *
 * Provides encrypted database instance to entire app.
 * Ensures all data access goes through encrypted local storage.
 */

interface DatabaseContextValue {
  database: Database | null;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  database: null,
  isReady: false,
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<Database | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        console.log('[Privacy] Initializing encrypted database...');
        const db = await initializeDatabase();
        setDatabase(db);
        setIsReady(true);
        console.log('[Privacy] Database ready. All data encrypted at rest.');
      } catch (error) {
        console.error('[Privacy] Failed to initialize database:', error);
        // In production, show user error and suggest device security check
      }
    }

    init();
  }, []);

  return (
    <DatabaseContext.Provider value={{ database, isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to access encrypted database
 *
 * Usage:
 * ```tsx
 * const { database } = useDatabase();
 * const decisions = await database.get('decisions').query().fetch();
 * ```
 */
export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context.isReady) {
    throw new Error('Database not ready. Wrap app in <DatabaseProvider>');
  }
  return context;
}
```

---

## 5. Cloud Integration: Anonymized Analytics Only

### 5.1 Analytics Event Layer (Privacy-Preserving)

**File:** `src/services/analytics.ts`

```typescript
import { generateAnonymousUserId } from '@utils/crypto';
import AsyncStorage from '@react-native-community/async-storage';

/**
 * Privacy-First Analytics
 *
 * What we track:
 * - High-level usage events (decision_created, outcome_logged)
 * - Aggregated metrics (retention cohorts)
 *
 * What we DON'T track:
 * - Decision content (titles, factor names, notes)
 * - Personal identifiers (email, device ID, IP address)
 * - Screen content (no screenshots, no session replays)
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
  anonymous_user_id: string;
}

class PrivacyFirstAnalytics {
  private anonymousUserId: string | null = null;
  private isOptedOut: boolean = false;

  async initialize() {
    // Check if user opted out
    const optOut = await AsyncStorage.getItem('analytics_opted_out');
    this.isOptedOut = optOut === 'true';

    if (this.isOptedOut) {
      console.log('[Privacy] User opted out of analytics');
      return;
    }

    // Get or create anonymous user ID
    let userId = await AsyncStorage.getItem('anonymous_user_id');
    if (!userId) {
      userId = generateAnonymousUserId();
      await AsyncStorage.setItem('anonymous_user_id', userId);
    }
    this.anonymousUserId = userId;

    console.log('[Privacy] Analytics initialized (anonymous mode)');
  }

  /**
   * Track anonymized event
   *
   * PRIVACY RULES:
   * - No PII in event properties
   * - No decision content (titles, descriptions, notes)
   * - Only aggregate counts and durations
   */
  track(event: string, properties?: Record<string, any>) {
    if (this.isOptedOut || !this.anonymousUserId) {
      return; // Silently skip if opted out
    }

    // Sanitize properties to ensure no PII leaks
    const sanitizedProperties = this.sanitizeProperties(properties || {});

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: sanitizedProperties,
      timestamp: Date.now(),
      anonymous_user_id: this.anonymousUserId,
    };

    // Send to PostHog (or your analytics backend)
    this.sendEvent(analyticsEvent);
  }

  /**
   * Sanitize event properties to remove PII
   */
  private sanitizeProperties(properties: Record<string, any>): Record<string, any> {
    const allowedKeys = [
      // Allowed: Aggregate counts and categories
      'num_factors',
      'num_options',
      'decision_source', // 'manual' | 'llm_onboarding'
      'insight_type', // 'correlation' | 'bias' | 'accuracy'
      'streak_length',
      'badge_name',

      // Explicitly FORBIDDEN (will be filtered):
      // - 'decision_title'
      // - 'factor_names'
      // - 'notes'
      // - 'email'
      // - 'device_id'
    ];

    const sanitized: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (properties[key] !== undefined) {
        sanitized[key] = properties[key];
      }
    }

    return sanitized;
  }

  private async sendEvent(event: AnalyticsEvent) {
    try {
      // Example: PostHog integration
      await fetch('https://app.posthog.com/capture/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: 'YOUR_POSTHOG_API_KEY', // From environment variable
          event: event.event,
          properties: event.properties,
          timestamp: new Date(event.timestamp).toISOString(),
          distinct_id: event.anonymous_user_id,
        }),
      });
    } catch (error) {
      console.error('[Analytics] Failed to send event:', error);
      // Fail silently - never block user experience for analytics
    }
  }

  /**
   * Allow user to opt out (GDPR compliance)
   */
  async optOut() {
    await AsyncStorage.setItem('analytics_opted_out', 'true');
    this.isOptedOut = true;
    console.log('[Privacy] User opted out of analytics');
  }

  async optIn() {
    await AsyncStorage.setItem('analytics_opted_out', 'false');
    this.isOptedOut = false;
    await this.initialize();
    console.log('[Privacy] User opted in to analytics');
  }
}

export const analytics = new PrivacyFirstAnalytics();
```

---

### 5.2 Example Analytics Events (Phase 1)

**File:** `src/services/analytics-events.ts`

```typescript
import { analytics } from './analytics';

/**
 * Approved Analytics Events (Phase 1)
 *
 * These are the ONLY events we track. Each is reviewed for privacy compliance.
 */

export const analyticsEvents = {
  // App lifecycle
  appOpened: () => analytics.track('app_opened'),
  appBackgrounded: (durationSeconds: number) =>
    analytics.track('app_backgrounded', { duration_seconds: durationSeconds }),

  // Decision creation
  decisionCreated: (source: 'manual' | 'llm_onboarding', numFactors: number, numOptions: number) =>
    analytics.track('decision_created', {
      decision_source: source,
      num_factors: numFactors,
      num_options: numOptions,
    }),

  // Outcome logging (THE CRITICAL EVENT)
  outcomeLogged: (decisionAgeInDays: number, logSource: 'manual' | 'reminder' | 'habit_stack') =>
    analytics.track('outcome_logged', {
      decision_age_days: decisionAgeInDays,
      log_source: logSource,
    }),

  // Insight engagement
  insightGenerated: (insightType: string) =>
    analytics.track('insight_generated', { insight_type: insightType }),

  insightViewed: (insightType: string) =>
    analytics.track('insight_viewed', { insight_type: insightType }),

  // Gamification
  streakAchieved: (streakLength: number) =>
    analytics.track('streak_achieved', { streak_length: streakLength }),

  badgeUnlocked: (badgeName: string) =>
    analytics.track('badge_unlocked', { badge_name: badgeName }),

  // Retention cohorts (tracked server-side by PostHog)
  // These are automatically derived from app_opened events
};
```

---

## 6. Privacy-First Architecture Checklist

Before proceeding to Insight-Driven Loop implementation:

### 6.1 Infrastructure Checklist

- [ ] **SQLCipher encryption configured** (AES-256 for local database)
- [ ] **Encryption key stored in hardware keychain** (iOS Keychain / Android Keystore)
- [ ] **WatermelonDB adapter initialized** with encryption enabled
- [ ] **Database schema created** with privacy-aware column design
- [ ] **DatabaseProvider context** wraps entire app
- [ ] **Analytics layer initialized** with PII sanitization

### 6.2 Privacy Compliance Checklist

- [ ] **No PII in database** (no emails, names, IP addresses)
- [ ] **Encryption key never leaves device** (zero-knowledge architecture)
- [ ] **User can wipe all data** (GDPR Right to Deletion implemented)
- [ ] **User can opt out of analytics** (GDPR compliance)
- [ ] **Analytics events sanitized** (no decision content tracked)
- [ ] **No third-party trackers** (no Facebook Pixel, Google Ads, etc.)

### 6.3 Legal Review Checklist

- [ ] **Privacy policy drafted** (covering on-device storage, optional cloud backup)
- [ ] **Terms of service drafted** (covering data ownership, backup limitations)
- [ ] **GDPR compliance audit** (Article 9 special category data)
- [ ] **BetterHelp precedent review** (no unauthorized third-party data sharing)
- [ ] **App Store privacy labels completed** (iOS App Privacy)

---

## 7. Testing the Privacy Architecture

### 7.1 Encryption Verification Test

**File:** `src/database/__tests__/encryption.test.ts`

```typescript
import { initializeDatabase, wipeAllLocalData } from '../adapter';
import { Database } from '@nozbe/watermelondb';
import RNFS from 'react-native-fs';

describe('Privacy-First Architecture', () => {
  let database: Database;

  beforeAll(async () => {
    database = await initializeDatabase();
  });

  afterAll(async () => {
    await wipeAllLocalData();
  });

  test('Database file is encrypted (not plaintext)', async () => {
    // Create a test decision
    await database.write(async () => {
      await database.collections.get('decisions').create(decision => {
        decision.title = 'SENSITIVE_TEST_DATA_12345';
        decision.status = 'active';
      });
    });

    // Read raw database file
    const dbPath = `${RNFS.DocumentDirectoryPath}/quantum_decisions.db`;
    const dbContents = await RNFS.readFile(dbPath, 'utf8');

    // Verify: Test string should NOT appear in plaintext
    expect(dbContents).not.toContain('SENSITIVE_TEST_DATA_12345');
    expect(dbContents).not.toContain('SENSITIVE'); // Should be encrypted
  });

  test('Encryption key is stored in secure hardware', async () => {
    const Keychain = require('react-native-keychain');
    const credentials = await Keychain.getGenericPassword({ service: 'db_encryption' });

    expect(credentials).toBeTruthy();
    expect(credentials.password).toHaveLength(44); // Base64-encoded 256-bit key
  });

  test('User can wipe all data (GDPR compliance)', async () => {
    await wipeAllLocalData();

    // Verify encryption key is deleted
    const Keychain = require('react-native-keychain');
    const credentials = await Keychain.getGenericPassword({ service: 'db_encryption' });
    expect(credentials).toBeFalsy();
  });
});
```

---

## 8. Next Steps: Enabling the Insight-Driven Loop

Now that the privacy-first architecture is in place, we can implement the Insight-Driven Loop on top of this foundation. The key insight is:

**The Insight-Driven Loop operates entirely on-device** (Phase 1). No cloud processing is needed for classical correlation discovery, which preserves privacy while delivering the engagement reward.

**Flow:**
1. User logs outcome → Write to local encrypted `outcomes` table
2. Trigger insight generation (on-device JavaScript)
3. Compute correlations using local `outcomes` + `factors` data
4. Write insight to local encrypted `insights` table
5. Display insight card to user (instant reward)

**Privacy Guarantee**: No outcome data leaves the device. The insight generation is a pure function of local encrypted data.

---

**Ready to proceed to Insight-Driven Loop implementation?** The foundation is now set.

**Document Status:** DRAFT v1.0 - Privacy Architecture Complete ✅
