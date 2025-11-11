import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, date, relation, children, readonly } from '@nozbe/watermelondb/decorators';
import { Decision } from './Decision';
import { FactorScore } from './FactorScore';

/**
 * Factor Model
 *
 * Represents a decision criterion (e.g., "Salary", "Work-Life Balance", "Learning Opportunities").
 * Each factor has a weight representing its importance (0.0 - 1.0, sum = 1.0 across all factors).
 *
 * Privacy: Factor names may reveal personal priorities (e.g., "Distance from ex-partner")
 */

export type FactorPreference = 'higher_is_better' | 'lower_is_better' | 'neutral';

export class Factor extends Model {
  static table = 'factors';

  static associations = {
    decisions: { type: 'belongs_to' as const, key: 'decision_id' },
    factor_scores: { type: 'has_many' as const, foreignKey: 'factor_id' },
  };

  // ==================== Fields ====================

  @field('decision_id') decisionId!: string;
  @field('name') name!: string;
  @field('description') description?: string;
  @field('weight') weight!: number; // 0.0 - 1.0 (importance)
  @field('preference') preference!: FactorPreference; // Direction of goodness

  @date('created_at') createdAt!: Date;
  @field('_deleted') _deleted!: boolean;

  // ==================== Associations ====================

  @relation('decisions', 'decision_id') decision!: Relation<Decision>;
  @children('factor_scores') factorScores!: Query<FactorScore>;

  // ==================== Readonly Fields ====================

  @readonly @date('created_at') readonly createdAtReadonly!: Date;

  // ==================== Computed Properties ====================

  /**
   * Get weight as percentage (0-100%)
   */
  get weightPercentage(): number {
    return Math.round(this.weight * 100);
  }

  /**
   * Get importance label
   */
  get importanceLabel(): 'Critical' | 'High' | 'Medium' | 'Low' {
    if (this.weight >= 0.3) return 'Critical';
    if (this.weight >= 0.2) return 'High';
    if (this.weight >= 0.1) return 'Medium';
    return 'Low';
  }

  /**
   * Get preference icon/indicator
   */
  get preferenceIndicator(): string {
    switch (this.preference) {
      case 'higher_is_better':
        return '↑';
      case 'lower_is_better':
        return '↓';
      case 'neutral':
        return '↔';
      default:
        return '?';
    }
  }

  /**
   * Check if this is the most important factor
   */
  async isMostImportant(): Promise<boolean> {
    const decision = await this.decision.fetch();
    const factors = await decision.factors.fetch();

    const maxWeight = Math.max(...factors.map(f => f.weight));
    return this.weight === maxWeight;
  }

  // ==================== Business Logic ====================

  /**
   * Get all scores for this factor across all options
   */
  async getScoresAcrossOptions(): Promise<FactorScore[]> {
    return await this.factorScores.fetch();
  }

  /**
   * Calculate variance of this factor's scores (measures discriminatory power)
   */
  async calculateScoreVariance(): Promise<number> {
    const scores = await this.factorScores.fetch();

    if (scores.length < 2) {
      return 0;
    }

    const scoreValues = scores.map(s => s.score);
    const mean = scoreValues.reduce((sum, val) => sum + val, 0) / scoreValues.length;
    const variance = scoreValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scoreValues.length;

    return variance;
  }

  /**
   * Check if this factor has discriminatory power (variance > threshold)
   * Low variance suggests the factor doesn't help distinguish between options
   */
  async hasDiscriminatoryPower(threshold: number = 0.5): Promise<boolean> {
    const variance = await this.calculateScoreVariance();
    return variance > threshold;
  }

  /**
   * Normalize weight to ensure all factors in decision sum to 1.0
   * This is called by the Decision model when updating factor weights
   */
  async normalizeWeightWithSiblings(): Promise<void> {
    const decision = await this.decision.fetch();
    const factors = await decision.factors.fetch();

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      // Normalize all weights proportionally
      await this.database.write(async () => {
        for (const factor of factors) {
          await factor.update(f => {
            f.weight = f.weight / totalWeight;
          });
        }
      });
    }
  }

  /**
   * Validate factor data
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Factor name cannot be empty');
    }

    if (this.name.length > 80) {
      errors.push('Factor name must be ≤80 characters');
    }

    if (this.weight < 0 || this.weight > 1) {
      errors.push('Weight must be between 0 and 1');
    }

    if (this.weight < 0.01) {
      errors.push('Weight too small (minimum 1%)');
    }

    const validPreferences: FactorPreference[] = ['higher_is_better', 'lower_is_better', 'neutral'];
    if (!validPreferences.includes(this.preference)) {
      errors.push(`Invalid preference: ${this.preference}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if total weights across all factors in decision sum to 1.0
   */
  async validateWeightSum(): Promise<{ valid: boolean; totalWeight: number }> {
    const decision = await this.decision.fetch();
    const factors = await decision.factors.fetch();

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const valid = Math.abs(totalWeight - 1.0) < 0.01; // Allow 1% rounding error

    return { valid, totalWeight };
  }

  /**
   * Get correlation with decision outcomes (if outcomes logged)
   * Measures how much this factor predicted actual satisfaction
   */
  async getOutcomeCorrelation(): Promise<number | null> {
    const decision = await this.decision.fetch();
    const outcomes = await decision.outcomes.fetch();

    if (outcomes.length < 3) {
      return null; // Insufficient data
    }

    // This is a placeholder for correlation analysis
    // Full implementation would track factor-satisfaction correlations
    // See correlation-discovery.ts for complete implementation

    return null;
  }

  /**
   * Prepare factor for LLM onboarding (minimal data)
   */
  toJSON(): { name: string; weight: number; description?: string } {
    return {
      name: this.name,
      weight: this.weight,
      description: this.description,
    };
  }

  /**
   * Clone this factor to another decision (useful for templates)
   */
  async cloneTo(targetDecisionId: string): Promise<Factor> {
    return await this.database.write(async () => {
      return await this.collections.get<Factor>('factors').create(factor => {
        factor.decisionId = targetDecisionId;
        factor.name = this.name;
        factor.description = this.description;
        factor.weight = this.weight;
        factor.preference = this.preference;
        factor.createdAt = new Date();
      });
    });
  }
}
