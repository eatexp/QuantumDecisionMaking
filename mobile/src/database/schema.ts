import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * WatermelonDB Schema for Quantum Decision Lab
 *
 * Privacy-First Design:
 * - All data stored in encrypted local database (SQLCipher)
 * - No PII or sensitive content synced to cloud by default
 * - Factor names and notes may contain personal information → encrypted at rest
 *
 * Schema Version: 1
 * Last Updated: 2025-11-11
 */

export const schema = appSchema({
  version: 1,
  tables: [
    // ==================== DECISIONS ====================
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
        { name: 'decision_method', type: 'string' }, // 'weighted' | 'pairwise' | 'llm_suggested'
        { name: 'source', type: 'string' }, // 'manual' | 'llm_onboarding'
        { name: 'tags', type: 'string', isOptional: true }, // JSON array
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    // ==================== OPTIONS ====================
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

    // ==================== FACTORS ====================
    tableSchema({
      name: 'factors',
      columns: [
        { name: 'decision_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' }, // SENSITIVE: May reveal personal priorities
        { name: 'description', type: 'string', isOptional: true },
        { name: 'weight', type: 'number' }, // 0.0 - 1.0
        { name: 'display_order', type: 'number' },
        { name: 'factor_type', type: 'string' }, // 'custom' | 'suggested' | 'template'
        { name: 'is_positive', type: 'boolean' }, // true = higher is better
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    // ==================== FACTOR SCORES ====================
    tableSchema({
      name: 'factor_scores',
      columns: [
        { name: 'option_id', type: 'string', isIndexed: true },
        { name: 'factor_id', type: 'string', isIndexed: true },
        { name: 'score', type: 'number' }, // 0.0 - 10.0
        { name: 'uncertainty', type: 'number' }, // 0.0 - 1.0
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    // ==================== OUTCOMES ====================
    tableSchema({
      name: 'outcomes',
      columns: [
        { name: 'decision_id', type: 'string', isIndexed: true },
        { name: 'logged_at', type: 'number', isIndexed: true },
        { name: 'actual_satisfaction', type: 'number' }, // 0.0 - 10.0
        { name: 'surprise_factor', type: 'number' }, // -3 to +3
        { name: 'notes', type: 'string', isOptional: true }, // HIGHLY SENSITIVE: Free-form text
        { name: 'context_tags', type: 'string', isOptional: true }, // JSON array
        { name: 'log_source', type: 'string' }, // 'manual' | 'reminder' | 'habit_stack'
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    // ==================== INSIGHTS ====================
    tableSchema({
      name: 'insights',
      columns: [
        { name: 'generated_at', type: 'number', isIndexed: true },
        { name: 'insight_type', type: 'string', isIndexed: true }, // 'correlation' | 'bias' | 'accuracy' | 'pattern' | 'achievement'
        { name: 'category', type: 'string' }, // 'general' | 'decision_specific' | 'behavioral'
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'data_payload', type: 'string', isOptional: true }, // JSON with supporting data
        { name: 'is_read', type: 'boolean', isIndexed: true },
        { name: 'is_archived', type: 'boolean' },
        { name: 'priority', type: 'number' }, // 0-10
        { name: 'related_decision_ids', type: 'string', isOptional: true }, // JSON array
        { name: 'expires_at', type: 'number', isOptional: true },
        { name: '_deleted', type: 'boolean' },
      ],
    }),

    // ==================== USER STATS ====================
    tableSchema({
      name: 'user_stats',
      columns: [
        { name: 'metric_key', type: 'string', isIndexed: true }, // Unique key (de-facto primary key)
        { name: 'metric_value', type: 'string' }, // JSON-serializable value
        { name: 'metric_type', type: 'string' }, // 'counter' | 'state' | 'achievement' | 'config'
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
