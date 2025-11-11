import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, json, relation, readonly } from '@nozbe/watermelondb/decorators';
import { Decision } from './Decision';

/**
 * Outcome Model
 *
 * Stores the real-world result of a decision after it's been made.
 * This is THE CRITICAL TABLE for the Insight-Driven Loop.
 *
 * Privacy: Notes field may contain highly sensitive free-form text → encrypted at rest
 */

export type LogSource = 'manual' | 'reminder' | 'habit_stack';

export class Outcome extends Model {
  static table = 'outcomes';

  static associations = {
    decision: { type: 'belongs_to' as const, key: 'decision_id' },
  };

  // ==================== Fields ====================

  @field('decision_id') decisionId!: string;
  @date('logged_at') loggedAt!: Date;

  @field('actual_satisfaction') actualSatisfaction!: number; // 0.0 - 10.0
  @field('surprise_factor') surpriseFactor!: number; // -3 to +3
  @field('notes') notes?: string;
  @field('log_source') logSource!: LogSource;

  @json('context_tags', sanitizeTags) contextTags!: string[];

  @field('_deleted') _deleted!: boolean;

  // ==================== Associations ====================

  @relation('decisions', 'decision_id') decision!: Relation<Decision>;

  // ==================== Readonly Fields ====================

  @readonly @date('logged_at') readonly loggedAtReadonly!: Date;

  // ==================== Computed Properties ====================

  /**
   * Was the outcome better than expected?
   */
  get wasBetterThanExpected(): boolean {
    return this.surpriseFactor > 0;
  }

  /**
   * Was the outcome worse than expected?
   */
  get wasWorseThanExpected(): boolean {
    return this.surpriseFactor < 0;
  }

  /**
   * Was the outcome as expected?
   */
  get wasAsExpected(): boolean {
    return this.surpriseFactor === 0;
  }

  /**
   * Satisfaction level (categorical)
   */
  get satisfactionLevel(): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (this.actualSatisfaction < 2) return 'very_low';
    if (this.actualSatisfaction < 4) return 'low';
    if (this.actualSatisfaction < 7) return 'medium';
    if (this.actualSatisfaction < 9) return 'high';
    return 'very_high';
  }

  /**
   * Get age of outcome in days
   */
  get ageInDays(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.loggedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // ==================== Business Logic ====================

  /**
   * Calculate prediction error (if decision has predicted satisfaction)
   * Returns null if no prediction available
   */
  async getPredictionError(): Promise<number | null> {
    const decision = await this.decision.fetch();
    const selectedOption = await decision.options.query().fetch();

    const selectedOpt = selectedOption.find(opt => opt.id === decision.selectedOptionId);

    if (!selectedOpt || selectedOpt.predictedSatisfaction === undefined) {
      return null;
    }

    return Math.abs(selectedOpt.predictedSatisfaction - this.actualSatisfaction);
  }

  /**
   * Validate outcome data
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.actualSatisfaction < 0 || this.actualSatisfaction > 10) {
      errors.push('Satisfaction must be between 0 and 10');
    }

    if (this.surpriseFactor < -3 || this.surpriseFactor > 3) {
      errors.push('Surprise factor must be between -3 and +3');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Sanitize context tags JSON
 */
function sanitizeTags(json: any): string[] {
  if (Array.isArray(json)) return json;
  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
