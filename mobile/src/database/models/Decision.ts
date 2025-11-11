import { Model, Query, Relation } from '@nozbe/watermelondb';
import { field, date, children, json, readonly, writer } from '@nozbe/watermelondb/decorators';
import { Option } from './Option';
import { Factor } from './Factor';
import { Outcome } from './Outcome';

/**
 * Decision Model
 *
 * Represents a user's decision problem with multiple options and factors.
 *
 * Privacy: All fields are stored in encrypted local database (SQLCipher)
 */

export type DecisionStatus = 'active' | 'completed' | 'archived';
export type DecisionMethod = 'weighted' | 'pairwise' | 'llm_suggested';
export type DecisionSource = 'manual' | 'llm_onboarding';

export class Decision extends Model {
  static table = 'decisions';

  static associations = {
    options: { type: 'has_many' as const, foreignKey: 'decision_id' },
    factors: { type: 'has_many' as const, foreignKey: 'decision_id' },
    outcomes: { type: 'has_many' as const, foreignKey: 'decision_id' },
  };

  // ==================== Fields ====================

  @field('title') title!: string;
  @field('description') description?: string;
  @field('status') status!: DecisionStatus;
  @field('decision_method') decisionMethod!: DecisionMethod;
  @field('source') source!: DecisionSource;
  @field('selected_option_id') selectedOptionId?: string;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('decision_date') decisionDate?: Date;

  @json('tags', sanitizeTags) tags!: string[];

  @field('_deleted') _deleted!: boolean;

  // ==================== Associations ====================

  @children('options') options!: Query<Option>;
  @children('factors') factors!: Query<Factor>;
  @children('outcomes') outcomes!: Query<Outcome>;

  // ==================== Readonly Fields ====================

  @readonly @date('created_at') readonly createdAtReadonly!: Date;

  // ==================== Computed Properties ====================

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isActive(): boolean {
    return this.status === 'active';
  }

  get isLLMGenerated(): boolean {
    return this.source === 'llm_onboarding';
  }

  /**
   * Get age of decision in days
   */
  get ageInDays(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // ==================== Business Logic ====================

  /**
   * Mark decision as completed with selected option
   */
  @writer async complete(selectedOptionId: string): Promise<void> {
    await this.update(decision => {
      decision.status = 'completed';
      decision.selectedOptionId = selectedOptionId;
      decision.decisionDate = new Date();
    });
  }

  /**
   * Archive decision (soft delete from active view)
   */
  @writer async archive(): Promise<void> {
    await this.update(decision => {
      decision.status = 'archived';
    });
  }

  /**
   * Reactivate archived decision
   */
  @writer async reactivate(): Promise<void> {
    await this.update(decision => {
      decision.status = 'active';
    });
  }

  /**
   * Soft delete decision (GDPR compliance)
   */
  @writer async softDelete(): Promise<void> {
    await this.update(decision => {
      decision._deleted = true;
    });
  }

  /**
   * Validate decision complexity
   * Enforces cognitive load limits (7±2 rule)
   */
  async validateComplexity(): Promise<{ valid: boolean; warnings: string[] }> {
    const options = await this.options.fetch();
    const factors = await this.factors.fetch();

    const warnings: string[] = [];

    if (options.length < 2) {
      return { valid: false, warnings: ['Decision must have at least 2 options'] };
    }

    if (factors.length === 0) {
      return { valid: false, warnings: ['Decision must have at least 1 factor'] };
    }

    if (factors.length > 10) {
      return { valid: false, warnings: ['Maximum 10 factors allowed (cognitive load limit)'] };
    }

    if (factors.length > 7) {
      warnings.push(`You have ${factors.length} factors. Consider consolidating to 5-7 for easier comparison.`);
    }

    if (options.length > 4) {
      warnings.push(`More than 4 options can be overwhelming. Consider narrowing down.`);
    }

    return { valid: true, warnings };
  }
}

/**
 * Sanitize tags JSON (ensure it's always an array)
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
