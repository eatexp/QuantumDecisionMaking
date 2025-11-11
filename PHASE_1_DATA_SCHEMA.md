# Phase 1 MVP: Data Schema & Models
## Quantum Decision Lab - Local Database Design

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Database:** SQLite + SQLCipher (encrypted)
**ORM:** WatermelonDB (React Native)

---

## 1. Schema Overview

### 1.1 Entity Relationship Diagram

```
┌─────────────┐
│  DECISIONS  │
│ (id, title) │
└──────┬──────┘
       │
       ├─────────────┬─────────────┬─────────────┬─────────────┐
       │             │             │             │             │
       ▼             ▼             ▼             ▼             ▼
   ┌───────┐    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │OPTIONS│    │ FACTORS │   │OUTCOMES │   │ INSIGHTS│   │DECISION_│
   │       │    │         │   │         │   │(related)│   │METADATA │
   └───┬───┘    └────┬────┘   └─────────┘   └─────────┘   └─────────┘
       │             │
       │             │
       ▼             ▼
┌──────────────────────┐
│   FACTOR_SCORES      │
│ (option_id,          │
│  factor_id, score)   │
└──────────────────────┘

┌──────────────┐
│  USER_STATS  │
│ (key, value) │
└──────────────┘
```

---

## 2. Core Tables

### 2.1 DECISIONS

**Purpose:** Store user's decision problems.

```sql
CREATE TABLE decisions (
    id TEXT PRIMARY KEY,                    -- UUID v4
    title TEXT NOT NULL,                    -- "Choose Job Offer"
    description TEXT,                       -- Optional long-form description
    created_at INTEGER NOT NULL,            -- Unix timestamp (milliseconds)
    updated_at INTEGER NOT NULL,            -- Auto-updated on modification
    status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'archived'
    selected_option_id TEXT,                -- Foreign key to options.id (nullable until decided)
    decision_date INTEGER,                  -- Unix timestamp when decision was made
    decision_method TEXT DEFAULT 'weighted', -- 'weighted' | 'pairwise' | 'llm_suggested'

    -- Metadata
    source TEXT DEFAULT 'manual',           -- 'manual' | 'llm_onboarding'
    tags TEXT,                              -- JSON array: ["career", "major_decision"]

    -- Soft delete support
    _deleted BOOLEAN DEFAULT 0,

    CHECK (status IN ('active', 'completed', 'archived')),
    CHECK (decision_method IN ('weighted', 'pairwise', 'llm_suggested'))
);

CREATE INDEX idx_decisions_status ON decisions(status) WHERE _deleted = 0;
CREATE INDEX idx_decisions_created_at ON decisions(created_at DESC);
```

**WatermelonDB Model:**
```typescript
import { Model } from '@nozbe/watermelondb';
import { field, date, children, json, readonly } from '@nozbe/watermelondb/decorators';

export class Decision extends Model {
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
  @date('updated_at') updatedAt!: Date;
  @date('decision_date') decisionDate?: Date;
  @field('selected_option_id') selectedOptionId?: string;
  @field('decision_method') decisionMethod!: string;
  @field('source') source!: string;
  @json('tags', sanitizeTags) tags!: string[];

  @children('options') options!: Query<Option>;
  @children('factors') factors!: Query<Factor>;
  @children('outcomes') outcomes!: Query<Outcome>;

  @readonly @date('created_at') createdAtReadonly!: Date;
}

const sanitizeTags = (json: any) => (Array.isArray(json) ? json : []);
```

---

### 2.2 OPTIONS

**Purpose:** Store alternatives for each decision.

```sql
CREATE TABLE options (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,              -- Foreign key to decisions.id
    name TEXT NOT NULL,                     -- "Job Offer A"
    description TEXT,                       -- Optional details
    display_order INTEGER NOT NULL DEFAULT 0, -- For UI ordering
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Predicted values (calculated by engine)
    predicted_satisfaction REAL,            -- 0.0 - 10.0 (null if not calculated)
    confidence_score REAL,                  -- 0.0 - 1.0 (Bayesian confidence)

    _deleted BOOLEAN DEFAULT 0,

    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    CHECK (predicted_satisfaction IS NULL OR (predicted_satisfaction >= 0 AND predicted_satisfaction <= 10)),
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE INDEX idx_options_decision ON options(decision_id) WHERE _deleted = 0;
```

**WatermelonDB Model:**
```typescript
export class Option extends Model {
  static table = 'options';
  static associations = {
    decision: { type: 'belongs_to', key: 'decision_id' },
    factor_scores: { type: 'has_many', foreignKey: 'option_id' }
  };

  @field('name') name!: string;
  @field('description') description?: string;
  @field('decision_id') decisionId!: string;
  @field('display_order') displayOrder!: number;
  @field('predicted_satisfaction') predictedSatisfaction?: number;
  @field('confidence_score') confidenceScore?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('factor_scores') factorScores!: Query<FactorScore>;
}
```

---

### 2.3 FACTORS

**Purpose:** Store decision criteria (e.g., "Salary", "Commute Time").

```sql
CREATE TABLE factors (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    name TEXT NOT NULL,                     -- "Salary"
    description TEXT,                       -- Optional explanation
    weight REAL NOT NULL DEFAULT 0.5,       -- 0.0 - 1.0 (importance)
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Metadata
    factor_type TEXT DEFAULT 'custom',      -- 'custom' | 'suggested' | 'template'
    is_positive BOOLEAN DEFAULT 1,          -- 1 = higher is better, 0 = lower is better

    _deleted BOOLEAN DEFAULT 0,

    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    CHECK (weight >= 0 AND weight <= 1),
    CHECK (factor_type IN ('custom', 'suggested', 'template'))
);

CREATE INDEX idx_factors_decision ON factors(decision_id) WHERE _deleted = 0;
```

**WatermelonDB Model:**
```typescript
export class Factor extends Model {
  static table = 'factors';
  static associations = {
    decision: { type: 'belongs_to', key: 'decision_id' },
    factor_scores: { type: 'has_many', foreignKey: 'factor_id' }
  };

  @field('name') name!: string;
  @field('description') description?: string;
  @field('decision_id') decisionId!: string;
  @field('weight') weight!: number;
  @field('display_order') displayOrder!: number;
  @field('factor_type') factorType!: string;
  @field('is_positive') isPositive!: boolean;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('factor_scores') factorScores!: Query<FactorScore>;
}
```

---

### 2.4 FACTOR_SCORES

**Purpose:** Store the Option × Factor matrix (how each option scores on each factor).

```sql
CREATE TABLE factor_scores (
    id TEXT PRIMARY KEY,
    option_id TEXT NOT NULL,
    factor_id TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 5.0,        -- 0.0 - 10.0 (user-provided or inferred)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Uncertainty (for future Bayesian modeling)
    uncertainty REAL DEFAULT 0.0,           -- 0.0 - 1.0 (0 = certain, 1 = complete guess)

    _deleted BOOLEAN DEFAULT 0,

    FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE CASCADE,
    FOREIGN KEY (factor_id) REFERENCES factors(id) ON DELETE CASCADE,
    UNIQUE(option_id, factor_id),           -- One score per option-factor pair
    CHECK (score >= 0 AND score <= 10),
    CHECK (uncertainty >= 0 AND uncertainty <= 1)
);

CREATE INDEX idx_factor_scores_option ON factor_scores(option_id);
CREATE INDEX idx_factor_scores_factor ON factor_scores(factor_id);
CREATE UNIQUE INDEX idx_factor_scores_unique ON factor_scores(option_id, factor_id) WHERE _deleted = 0;
```

**WatermelonDB Model:**
```typescript
export class FactorScore extends Model {
  static table = 'factor_scores';
  static associations = {
    option: { type: 'belongs_to', key: 'option_id' },
    factor: { type: 'belongs_to', key: 'factor_id' }
  };

  @field('option_id') optionId!: string;
  @field('factor_id') factorId!: string;
  @field('score') score!: number;
  @field('uncertainty') uncertainty!: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
```

---

### 2.5 OUTCOMES

**Purpose:** Store real-world results of decisions (THE CRITICAL TABLE FOR RETENTION).

```sql
CREATE TABLE outcomes (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    logged_at INTEGER NOT NULL,             -- Unix timestamp

    -- Core outcome data
    actual_satisfaction REAL NOT NULL,      -- 0.0 - 10.0 (how satisfied user was)
    surprise_factor INTEGER DEFAULT 0,      -- -3 (much worse) to +3 (much better)
    notes TEXT,                             -- Free-form user notes

    -- Context (for correlation analysis)
    context_tags TEXT,                      -- JSON array: ["work", "stressed", "monday"]

    -- Metadata
    log_source TEXT DEFAULT 'manual',       -- 'manual' | 'reminder' | 'habit_stack'

    _deleted BOOLEAN DEFAULT 0,

    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    CHECK (actual_satisfaction >= 0 AND actual_satisfaction <= 10),
    CHECK (surprise_factor >= -3 AND surprise_factor <= 3),
    CHECK (log_source IN ('manual', 'reminder', 'habit_stack'))
);

CREATE INDEX idx_outcomes_decision ON outcomes(decision_id);
CREATE INDEX idx_outcomes_logged_at ON outcomes(logged_at DESC);
```

**WatermelonDB Model:**
```typescript
export class Outcome extends Model {
  static table = 'outcomes';
  static associations = {
    decision: { type: 'belongs_to', key: 'decision_id' }
  };

  @field('decision_id') decisionId!: string;
  @date('logged_at') loggedAt!: Date;
  @field('actual_satisfaction') actualSatisfaction!: number;
  @field('surprise_factor') surpriseFactor!: number;
  @field('notes') notes?: string;
  @json('context_tags', sanitizeTags) contextTags!: string[];
  @field('log_source') logSource!: string;
}
```

---

### 2.6 INSIGHTS

**Purpose:** Store generated insights for the Insight-Driven Loop.

```sql
CREATE TABLE insights (
    id TEXT PRIMARY KEY,
    generated_at INTEGER NOT NULL,

    -- Insight classification
    insight_type TEXT NOT NULL,             -- 'correlation' | 'bias' | 'accuracy' | 'pattern' | 'counterfactual'
    category TEXT DEFAULT 'general',        -- 'general' | 'decision_specific' | 'behavioral'

    -- Content
    title TEXT NOT NULL,                    -- "Sleep correlates with productivity"
    description TEXT NOT NULL,              -- Full explanation
    data_payload TEXT,                      -- JSON with supporting data (e.g., correlation coefficient)

    -- UI state
    is_read BOOLEAN DEFAULT 0,
    is_archived BOOLEAN DEFAULT 0,
    priority INTEGER DEFAULT 0,             -- 0-10 (for sorting)

    -- Relationships
    related_decision_ids TEXT,              -- JSON array of decision IDs

    -- Expiry (for time-sensitive insights)
    expires_at INTEGER,                     -- Optional: insight relevance window

    _deleted BOOLEAN DEFAULT 0,

    CHECK (insight_type IN ('correlation', 'bias', 'accuracy', 'pattern', 'counterfactual', 'achievement')),
    CHECK (category IN ('general', 'decision_specific', 'behavioral')),
    CHECK (priority >= 0 AND priority <= 10)
);

CREATE INDEX idx_insights_generated_at ON insights(generated_at DESC);
CREATE INDEX idx_insights_unread ON insights(is_read, is_archived) WHERE _deleted = 0;
CREATE INDEX idx_insights_type ON insights(insight_type);
```

**WatermelonDB Model:**
```typescript
export class Insight extends Model {
  static table = 'insights';

  @date('generated_at') generatedAt!: Date;
  @field('insight_type') insightType!: string;
  @field('category') category!: string;
  @field('title') title!: string;
  @field('description') description!: string;
  @json('data_payload', (json) => json || {}) dataPayload!: any;
  @field('is_read') isRead!: boolean;
  @field('is_archived') isArchived!: boolean;
  @field('priority') priority!: number;
  @json('related_decision_ids', sanitizeTags) relatedDecisionIds!: string[];
  @date('expires_at') expiresAt?: Date;
}
```

---

### 2.7 USER_STATS

**Purpose:** Store gamification state and user-level metrics (flexible key-value store).

```sql
CREATE TABLE user_stats (
    metric_key TEXT PRIMARY KEY,            -- 'current_streak', 'total_outcomes_logged'
    metric_value TEXT NOT NULL,             -- JSON-serializable value (string, number, array, object)
    updated_at INTEGER NOT NULL,

    -- Metadata
    metric_type TEXT DEFAULT 'counter',     -- 'counter' | 'state' | 'achievement'

    CHECK (metric_type IN ('counter', 'state', 'achievement', 'config'))
);

CREATE INDEX idx_user_stats_type ON user_stats(metric_type);
```

**Example Rows:**
```sql
INSERT INTO user_stats (metric_key, metric_value, metric_type) VALUES
  ('current_streak', '7', 'counter'),
  ('longest_streak', '14', 'counter'),
  ('total_outcomes_logged', '23', 'counter'),
  ('total_decisions_created', '12', 'counter'),
  ('badges_earned', '["first_decision", "week_warrior"]', 'achievement'),
  ('last_streak_date', '2025-11-11', 'state'),
  ('streak_recovery_used_at', '2025-11-05', 'state'),
  ('decision_accuracy_score', '78.5', 'counter'),
  ('habit_stack_anchor', '{"routine": "morning_coffee", "time": "08:00"}', 'config');
```

**WatermelonDB Model:**
```typescript
export class UserStat extends Model {
  static table = 'user_stats';

  @field('metric_key') metricKey!: string; // This is actually the primary key
  @field('metric_value') metricValue!: string;
  @date('updated_at') updatedAt!: Date;
  @field('metric_type') metricType!: string;

  // Helper methods
  get numericValue(): number {
    return parseFloat(this.metricValue);
  }

  get jsonValue(): any {
    try {
      return JSON.parse(this.metricValue);
    } catch {
      return this.metricValue;
    }
  }
}
```

---

## 3. Derived/Computed Tables (Views)

### 3.1 DECISION_SUMMARY (View)

**Purpose:** Aggregate decision metrics for quick dashboard queries.

```sql
CREATE VIEW decision_summary AS
SELECT
    d.id,
    d.title,
    d.status,
    d.created_at,
    d.decision_date,
    COUNT(DISTINCT o.id) AS num_options,
    COUNT(DISTINCT f.id) AS num_factors,
    COUNT(DISTINCT oc.id) AS num_outcomes,
    AVG(oc.actual_satisfaction) AS avg_satisfaction,
    MAX(oc.logged_at) AS last_outcome_logged_at
FROM decisions d
LEFT JOIN options o ON d.id = o.decision_id AND o._deleted = 0
LEFT JOIN factors f ON d.id = f.decision_id AND f._deleted = 0
LEFT JOIN outcomes oc ON d.id = oc.decision_id AND oc._deleted = 0
WHERE d._deleted = 0
GROUP BY d.id;
```

---

## 4. Data Validation & Constraints

### 4.1 Business Rules

1. **Decision must have ≥2 options**
   - Enforced at application layer (not DB constraint, for flexibility during creation)

2. **Decision must have ≥1 factor**
   - Enforced at application layer

3. **Factor weights must sum to ≤1.0**
   - Enforced at application layer (normalized on save)

4. **Maximum 15 factors per decision**
   - Enforced at application layer (cognitive load limit)

5. **Outcome can only be logged for completed decisions**
   - Enforced at application layer

---

### 4.2 Data Integrity Checks (Application Layer)

```typescript
// Example validation before saving a decision
async function validateDecision(decision: Decision): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  const options = await decision.options.fetch();
  if (options.length < 2) {
    errors.push({ field: 'options', message: 'Decision must have at least 2 options' });
  }

  const factors = await decision.factors.fetch();
  if (factors.length === 0) {
    errors.push({ field: 'factors', message: 'Decision must have at least 1 factor' });
  }
  if (factors.length > 15) {
    errors.push({ field: 'factors', message: 'Maximum 15 factors allowed (cognitive load limit)' });
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight > 1.0) {
    errors.push({ field: 'factors', message: 'Total factor weights cannot exceed 1.0' });
  }

  return errors;
}
```

---

## 5. Migration Strategy

### 5.1 Initial Schema (Version 1)

**File:** `src/database/migrations/001_initial_schema.ts`

```typescript
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 1,
      steps: [
        {
          type: 'create_table',
          name: 'decisions',
          columns: [
            { name: 'title', type: 'string' },
            { name: 'description', type: 'string', isOptional: true },
            { name: 'status', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'decision_date', type: 'number', isOptional: true },
            { name: 'selected_option_id', type: 'string', isOptional: true },
            { name: 'decision_method', type: 'string' },
            { name: 'source', type: 'string' },
            { name: 'tags', type: 'string', isOptional: true },
            { name: '_deleted', type: 'boolean' }
          ]
        },
        {
          type: 'create_table',
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
            { name: '_deleted', type: 'boolean' }
          ]
        },
        // ... (other tables)
      ]
    }
  ]
});
```

### 5.2 Future Migrations (Example: Add QLBN-Specific Fields in Phase 2)

**File:** `src/database/migrations/002_add_qlbn_fields.ts`

```typescript
export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        {
          type: 'add_column',
          table: 'factors',
          column: { name: 'phase_angle', type: 'number', isOptional: true }
        },
        {
          type: 'add_column',
          table: 'factor_scores',
          column: { name: 'amplitude', type: 'number', isOptional: true }
        },
        {
          type: 'create_table',
          name: 'entanglements',
          columns: [
            { name: 'factor_a_id', type: 'string', isIndexed: true },
            { name: 'factor_b_id', type: 'string', isIndexed: true },
            { name: 'correlation_strength', type: 'number' },
            { name: 'discovered_at', type: 'number' }
          ]
        }
      ]
    }
  ]
});
```

---

## 6. Sample Data (For Testing)

### 6.1 Example Decision: "Choose Job Offer"

```typescript
const sampleDecision = {
  id: 'dec-001',
  title: 'Choose Job Offer',
  description: 'Deciding between two competing job offers after graduation',
  status: 'completed',
  source: 'llm_onboarding',
  decision_date: new Date('2025-11-10'),
  selected_option_id: 'opt-001'
};

const sampleOptions = [
  {
    id: 'opt-001',
    decision_id: 'dec-001',
    name: 'Company A (Tech Startup)',
    description: 'Fast-paced startup, equity, long hours',
    predicted_satisfaction: 7.2,
    confidence_score: 0.73
  },
  {
    id: 'opt-002',
    decision_id: 'dec-001',
    name: 'Company B (Fortune 500)',
    description: 'Stable, good benefits, slower career growth',
    predicted_satisfaction: 6.8,
    confidence_score: 0.81
  }
];

const sampleFactors = [
  { id: 'fac-001', decision_id: 'dec-001', name: 'Salary', weight: 0.35 },
  { id: 'fac-002', decision_id: 'dec-001', name: 'Work-Life Balance', weight: 0.25 },
  { id: 'fac-003', decision_id: 'dec-001', name: 'Career Growth', weight: 0.20 },
  { id: 'fac-004', decision_id: 'dec-001', name: 'Commute Time', weight: 0.15 },
  { id: 'fac-005', decision_id: 'dec-001', name: 'Team Culture', weight: 0.05 }
];

const sampleFactorScores = [
  // Company A scores
  { option_id: 'opt-001', factor_id: 'fac-001', score: 7.0 }, // Salary: 7/10
  { option_id: 'opt-001', factor_id: 'fac-002', score: 4.0 }, // WLB: 4/10 (long hours)
  { option_id: 'opt-001', factor_id: 'fac-003', score: 9.0 }, // Growth: 9/10
  { option_id: 'opt-001', factor_id: 'fac-004', score: 6.0 }, // Commute: 6/10
  { option_id: 'opt-001', factor_id: 'fac-005', score: 8.0 }, // Culture: 8/10

  // Company B scores
  { option_id: 'opt-002', factor_id: 'fac-001', score: 8.0 },
  { option_id: 'opt-002', factor_id: 'fac-002', score: 9.0 },
  { option_id: 'opt-002', factor_id: 'fac-003', score: 5.0 },
  { option_id: 'opt-002', factor_id: 'fac-004', score: 8.0 },
  { option_id: 'opt-002', factor_id: 'fac-005', score: 7.0 }
];

const sampleOutcome = {
  id: 'out-001',
  decision_id: 'dec-001',
  logged_at: new Date('2025-11-11'),
  actual_satisfaction: 8.5, // User was very satisfied (predicted 7.2)
  surprise_factor: 1, // Slightly better than expected
  notes: 'Company A turned out to be amazing! The equity package and learning curve are incredible.',
  context_tags: ['career', 'major_decision'],
  log_source: 'habit_stack'
};

const generatedInsight = {
  id: 'ins-001',
  generated_at: new Date('2025-11-11'),
  insight_type: 'accuracy',
  title: 'Great prediction!',
  description: 'You predicted 7.2/10 satisfaction and actually experienced 8.5/10. Your accuracy is improving!',
  data_payload: JSON.stringify({
    predicted: 7.2,
    actual: 8.5,
    delta: 1.3,
    accuracy_trend: 'improving'
  }),
  related_decision_ids: JSON.stringify(['dec-001']),
  priority: 8
};
```

---

## 7. Query Patterns (Common Use Cases)

### 7.1 Fetch Active Decisions with Options

```typescript
const activeDecisions = await database.collections
  .get<Decision>('decisions')
  .query(
    Q.where('status', 'active'),
    Q.sortBy('created_at', Q.desc)
  )
  .fetch();

// Fetch with eager-loaded options
const decisionsWithOptions = await activeDecisions.map(async (decision) => ({
  decision,
  options: await decision.options.fetch(),
  factors: await decision.factors.fetch()
}));
```

### 7.2 Calculate Decision Recommendation

```typescript
async function getRecommendation(decisionId: string) {
  const decision = await database.get<Decision>('decisions').find(decisionId);
  const options = await decision.options.fetch();
  const factors = await decision.factors.fetch();

  const scores = await Promise.all(
    options.map(async (option) => {
      const factorScores = await option.factorScores.fetch();

      let totalScore = 0;
      let maxPossibleScore = 0;

      factors.forEach((factor) => {
        const score = factorScores.find(fs => fs.factorId === factor.id)?.score ?? 5;
        totalScore += factor.weight * score;
        maxPossibleScore += factor.weight * 10;
      });

      const normalizedScore = (totalScore / maxPossibleScore) * 10;

      return {
        optionId: option.id,
        optionName: option.name,
        score: normalizedScore
      };
    })
  );

  scores.sort((a, b) => b.score - a.score);
  return scores;
}
```

### 7.3 Generate Correlation Insight

```typescript
async function findCorrelations(): Promise<Insight[]> {
  const outcomes = await database.collections.get<Outcome>('outcomes')
    .query(Q.sortBy('logged_at', Q.desc), Q.take(20))
    .fetch();

  if (outcomes.length < 5) return [];

  // Group outcomes by factor
  const factorSatisfactionMap = new Map<string, number[]>();

  for (const outcome of outcomes) {
    const decision = await outcome.decision.fetch();
    const factors = await decision.factors.fetch();

    for (const factor of factors) {
      if (!factorSatisfactionMap.has(factor.name)) {
        factorSatisfactionMap.set(factor.name, []);
      }
      factorSatisfactionMap.get(factor.name)!.push(outcome.actualSatisfaction);
    }
  }

  const insights: Insight[] = [];

  factorSatisfactionMap.forEach((satisfactions, factorName) => {
    const correlation = calculatePearsonCorrelation(satisfactions);

    if (Math.abs(correlation) > 0.6) {
      insights.push({
        insight_type: 'correlation',
        title: `${factorName} strongly influences your satisfaction`,
        description: `${(correlation * 100).toFixed(0)}% correlation detected`,
        data_payload: { factorName, correlation }
      });
    }
  });

  return insights;
}
```

### 7.4 Update Streak on Outcome Log

```typescript
async function updateStreakAfterLog(logDate: Date) {
  const streakStat = await database.get<UserStat>('user_stats').find('current_streak');
  const lastLogStat = await database.get<UserStat>('user_stats').find('last_streak_date');

  const lastLogDate = new Date(lastLogStat.metricValue);
  const daysSince = daysBetween(lastLogDate, logDate);

  await database.write(async () => {
    if (daysSince === 1) {
      // Continue streak
      await streakStat.update(stat => {
        stat.metricValue = (parseInt(stat.metricValue) + 1).toString();
      });
    } else if (daysSince > 1) {
      // Reset streak
      await streakStat.update(stat => {
        stat.metricValue = '1';
      });
    }

    await lastLogStat.update(stat => {
      stat.metricValue = logDate.toISOString();
    });
  });
}
```

---

## 8. Performance Optimization

### 8.1 Indexing Strategy

- **Primary Indexes:** Already defined in table schemas
- **Composite Indexes (if needed):**
  ```sql
  CREATE INDEX idx_outcomes_decision_date ON outcomes(decision_id, logged_at DESC);
  CREATE INDEX idx_insights_unread_priority ON insights(is_read, priority DESC) WHERE is_archived = 0;
  ```

### 8.2 Query Optimization Tips

1. **Use Q.take() for pagination**
   ```typescript
   .query(Q.sortBy('created_at', Q.desc), Q.take(20))
   ```

2. **Eager load related records in batch**
   ```typescript
   const decisions = await decisionsQuery.fetch();
   await decisions.map(d => d.options.fetch()); // Batch load
   ```

3. **Use observables for reactive UI (avoid repeated fetches)**
   ```typescript
   const decisions$ = database.collections.get<Decision>('decisions')
     .query(Q.where('status', 'active'))
     .observe();
   ```

---

## 9. Data Export & Portability

### 9.1 Export Format (GDPR Compliance)

**User-Initiated Export:**
```typescript
async function exportUserData(): Promise<ExportPackage> {
  const decisions = await database.collections.get<Decision>('decisions').query().fetch();
  const outcomes = await database.collections.get<Outcome>('outcomes').query().fetch();
  const insights = await database.collections.get<Insight>('insights').query().fetch();
  const stats = await database.collections.get<UserStat>('user_stats').query().fetch();

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    decisions: decisions.map(d => d._raw),
    outcomes: outcomes.map(o => o._raw),
    insights: insights.map(i => i._raw),
    stats: stats.reduce((obj, stat) => {
      obj[stat.metricKey] = stat.metricValue;
      return obj;
    }, {} as Record<string, string>)
  };
}
```

**Export to JSON file:**
```typescript
const data = await exportUserData();
const json = JSON.stringify(data, null, 2);
await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}/export.json`, json);
// Share via system share sheet
```

---

## 10. Schema Validation Checklist

Before Phase 1 launch:

- [ ] All tables have primary keys (UUID v4)
- [ ] All foreign keys have ON DELETE CASCADE
- [ ] All indexes are created for common query patterns
- [ ] Soft delete (_deleted) implemented consistently
- [ ] Check constraints enforce business rules
- [ ] WatermelonDB models match SQL schema
- [ ] Migration scripts tested (version 1 → 2)
- [ ] Sample data loads successfully
- [ ] Export functionality tested (GDPR compliance)
- [ ] Database encryption (SQLCipher) configured

---

## Conclusion

This schema is designed for **Phase 1 simplicity** while maintaining **Phase 2 extensibility**. The use of JSON columns (tags, data_payload) provides flexibility for rapid iteration without schema migrations, while the core relational structure ensures data integrity and query performance.

**Next Step:** Implement WatermelonDB setup and begin Month 1 Week 1 development.

---

**Document Status:** DRAFT v1.0 - Ready for Implementation
