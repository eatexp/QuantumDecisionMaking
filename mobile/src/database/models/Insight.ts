import { Model, Q } from '@nozbe/watermelondb';
import { field, date, json, readonly, writer } from '@nozbe/watermelondb/decorators';

/**
 * Insight Model
 *
 * THE CRITICAL MODEL FOR THE INSIGHT-DRIVEN LOOP (THE MOAT)
 *
 * Stores high-value, non-obvious insights generated after each outcome log.
 * These insights are the reward mechanism that transforms outcome logging
 * from a chore into a value-creating event.
 *
 * Insight Types:
 * - correlation: Factor-satisfaction relationships (e.g., "Sleep correlates 0.78 with Productivity")
 * - bias_detection: Cognitive biases identified (e.g., "You overestimate time savings by 40%")
 * - accuracy_tracking: Prediction vs. reality (e.g., "You're 85% accurate predicting satisfaction")
 * - pattern: Behavioral patterns (e.g., "Morning decisions are 2x more accurate")
 * - achievement: Gamification milestones (e.g., "🔥 10-day logging streak!")
 *
 * Privacy: Insights may contain sensitive inferences → encrypted at rest
 */

export type InsightType =
  | 'correlation'
  | 'bias_detection'
  | 'accuracy_tracking'
  | 'pattern'
  | 'achievement'
  | 'suggestion';

export type InsightPriority = 1 | 2 | 3 | 4 | 5; // 1 = highest, 5 = lowest

export interface InsightMetadata {
  // For correlation insights
  correlation_coefficient?: number;
  p_value?: number;
  sample_size?: number;
  factor_name?: string;
  target_metric?: string;

  // For bias detection
  bias_type?: string;
  magnitude?: number;

  // For accuracy tracking
  accuracy_percentage?: number;
  prediction_error?: number;

  // For achievements
  streak_count?: number;
  total_count?: number;
  badge_name?: string;

  // For patterns
  pattern_type?: string;
  confidence?: number;

  // Related entities
  decision_ids?: string[];
  outcome_ids?: string[];
}

export class Insight extends Model {
  static table = 'insights';

  // ==================== Fields ====================

  @field('insight_type') insightType!: InsightType;
  @field('title') title!: string; // Short, attention-grabbing title
  @field('description') description!: string; // Detailed explanation
  @field('priority') priority!: InsightPriority; // 1 = highest
  @field('is_read') isRead!: boolean;
  @field('is_actionable') isActionable!: boolean; // Can user act on this?
  @field('action_label') actionLabel?: string; // e.g., "Adjust factor weight"

  @json('metadata', sanitizeMetadata) metadata!: InsightMetadata;

  @date('generated_at') generatedAt!: Date;
  @date('read_at') readAt?: Date;
  @date('dismissed_at') dismissedAt?: Date;

  @field('_deleted') _deleted!: boolean;

  // ==================== Readonly Fields ====================

  @readonly @date('generated_at') readonly generatedAtReadonly!: Date;

  // ==================== Computed Properties ====================

  /**
   * Get insight age in hours
   */
  get ageInHours(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.generatedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  /**
   * Get insight age in days
   */
  get ageInDays(): number {
    return Math.floor(this.ageInHours / 24);
  }

  /**
   * Check if insight is fresh (<24 hours old)
   */
  get isFresh(): boolean {
    return this.ageInHours < 24;
  }

  /**
   * Check if insight is stale (>7 days old)
   */
  get isStale(): boolean {
    return this.ageInDays > 7;
  }

  /**
   * Get priority label
   */
  get priorityLabel(): 'Critical' | 'High' | 'Medium' | 'Low' | 'Info' {
    switch (this.priority) {
      case 1:
        return 'Critical';
      case 2:
        return 'High';
      case 3:
        return 'Medium';
      case 4:
        return 'Low';
      case 5:
        return 'Info';
      default:
        return 'Info';
    }
  }

  /**
   * Get insight type label (user-friendly)
   */
  get typeLabel(): string {
    switch (this.insightType) {
      case 'correlation':
        return 'Correlation Discovery';
      case 'bias_detection':
        return 'Bias Alert';
      case 'accuracy_tracking':
        return 'Accuracy Report';
      case 'pattern':
        return 'Pattern Detected';
      case 'achievement':
        return 'Achievement';
      case 'suggestion':
        return 'Suggestion';
      default:
        return 'Insight';
    }
  }

  /**
   * Get icon for insight type
   */
  get typeIcon(): string {
    switch (this.insightType) {
      case 'correlation':
        return '📊';
      case 'bias_detection':
        return '⚠️';
      case 'accuracy_tracking':
        return '🎯';
      case 'pattern':
        return '🔍';
      case 'achievement':
        return '🏆';
      case 'suggestion':
        return '💡';
      default:
        return '💭';
    }
  }

  /**
   * Check if insight is dismissed
   */
  get isDismissed(): boolean {
    return this.dismissedAt !== undefined;
  }

  // ==================== Business Logic ====================

  /**
   * Mark insight as read
   */
  @writer async markAsRead(): Promise<void> {
    if (this.isRead) return; // Already read

    await this.update(insight => {
      insight.isRead = true;
      insight.readAt = new Date();
    });
  }

  /**
   * Dismiss insight (hide from main feed)
   */
  @writer async dismiss(): Promise<void> {
    if (this.isDismissed) return; // Already dismissed

    await this.update(insight => {
      insight.dismissedAt = new Date();
    });
  }

  /**
   * Un-dismiss insight (restore to main feed)
   */
  @writer async undismiss(): Promise<void> {
    if (!this.isDismissed) return; // Not dismissed

    await this.update(insight => {
      insight.dismissedAt = undefined;
    });
  }

  /**
   * Validate insight data
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Title cannot be empty');
    }

    if (this.title.length > 100) {
      errors.push('Title must be ≤100 characters');
    }

    if (!this.description || this.description.trim().length === 0) {
      errors.push('Description cannot be empty');
    }

    if (this.description.length > 500) {
      errors.push('Description must be ≤500 characters');
    }

    const validTypes: InsightType[] = [
      'correlation',
      'bias_detection',
      'accuracy_tracking',
      'pattern',
      'achievement',
      'suggestion',
    ];
    if (!validTypes.includes(this.insightType)) {
      errors.push(`Invalid insight type: ${this.insightType}`);
    }

    const validPriorities: InsightPriority[] = [1, 2, 3, 4, 5];
    if (!validPriorities.includes(this.priority)) {
      errors.push(`Invalid priority: ${this.priority}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get engagement score (used for ranking insights)
   * Higher score = more engaging
   */
  getEngagementScore(): number {
    let score = 0;

    // Priority boost (highest priority = highest score)
    score += (6 - this.priority) * 10;

    // Freshness boost (fresh insights are more relevant)
    if (this.isFresh) {
      score += 20;
    } else if (this.ageInDays <= 3) {
      score += 10;
    }

    // Unread boost
    if (!this.isRead) {
      score += 15;
    }

    // Actionable boost
    if (this.isActionable) {
      score += 5;
    }

    // Type-specific boosts
    switch (this.insightType) {
      case 'correlation':
        score += 15; // High-value insights
        break;
      case 'bias_detection':
        score += 12; // Important but potentially negative
        break;
      case 'accuracy_tracking':
        score += 10;
        break;
      case 'pattern':
        score += 8;
        break;
      case 'achievement':
        score += 5; // Feel-good but lower informational value
        break;
      case 'suggestion':
        score += 7;
        break;
    }

    return score;
  }

  /**
   * Format for display in UI
   */
  toDisplayFormat(): {
    id: string;
    icon: string;
    typeLabel: string;
    title: string;
    description: string;
    priority: string;
    isNew: boolean;
    isActionable: boolean;
    actionLabel?: string;
    ageLabel: string;
  } {
    return {
      id: this.id,
      icon: this.typeIcon,
      typeLabel: this.typeLabel,
      title: this.title,
      description: this.description,
      priority: this.priorityLabel,
      isNew: !this.isRead,
      isActionable: this.isActionable,
      actionLabel: this.actionLabel,
      ageLabel: this.getAgeLabel(),
    };
  }

  /**
   * Get human-readable age label
   */
  private getAgeLabel(): string {
    if (this.ageInHours < 1) return 'Just now';
    if (this.ageInHours === 1) return '1 hour ago';
    if (this.ageInHours < 24) return `${this.ageInHours} hours ago`;
    if (this.ageInDays === 1) return '1 day ago';
    if (this.ageInDays < 7) return `${this.ageInDays} days ago`;
    if (this.ageInDays < 30) return `${Math.floor(this.ageInDays / 7)} weeks ago`;
    return `${Math.floor(this.ageInDays / 30)} months ago`;
  }

  // ==================== Static Queries ====================

  /**
   * Get unread insights count
   */
  static async getUnreadCount(database: any): Promise<number> {
    const insights = await database.collections
      .get<Insight>('insights')
      .query(Q.where('is_read', false), Q.where('dismissed_at', null))
      .fetchCount();

    return insights;
  }

  /**
   * Get top priority unread insights
   */
  static async getTopUnread(database: any, limit: number = 3): Promise<Insight[]> {
    const insights = await database.collections
      .get<Insight>('insights')
      .query(
        Q.where('is_read', false),
        Q.where('dismissed_at', null),
        Q.sortBy('priority', Q.asc), // Lower priority number = higher priority
        Q.sortBy('generated_at', Q.desc),
        Q.take(limit)
      )
      .fetch();

    return insights;
  }

  /**
   * Get insights by type
   */
  static async getByType(database: any, type: InsightType): Promise<Insight[]> {
    const insights = await database.collections
      .get<Insight>('insights')
      .query(
        Q.where('insight_type', type),
        Q.where('dismissed_at', null),
        Q.sortBy('generated_at', Q.desc)
      )
      .fetch();

    return insights;
  }
}

/**
 * Sanitize metadata JSON
 */
function sanitizeMetadata(json: any): InsightMetadata {
  if (typeof json === 'object' && json !== null) {
    return json as InsightMetadata;
  }

  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json);
      return parsed as InsightMetadata;
    } catch {
      return {};
    }
  }

  return {};
}
