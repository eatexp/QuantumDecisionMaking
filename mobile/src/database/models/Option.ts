import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, date, relation, children, readonly } from '@nozbe/watermelondb/decorators';
import { Decision } from './Decision';
import { FactorScore } from './FactorScore';

/**
 * Option Model
 *
 * Represents a choice alternative within a decision.
 * Each option has scores for multiple factors, which are aggregated to compute utility.
 *
 * Privacy: Option names may be sensitive (e.g., "Accept job at Company X")
 */

export class Option extends Model {
  static table = 'options';

  static associations = {
    decisions: { type: 'belongs_to' as const, key: 'decision_id' },
    factor_scores: { type: 'has_many' as const, foreignKey: 'option_id' },
  };

  // ==================== Fields ====================

  @field('decision_id') decisionId!: string;
  @field('name') name!: string;
  @field('description') description?: string;
  @field('predicted_satisfaction') predictedSatisfaction?: number; // 0.0 - 10.0
  @field('computed_utility') computedUtility?: number; // 0.0 - 1.0
  @field('is_selected') isSelected!: boolean;

  @date('created_at') createdAt!: Date;
  @field('_deleted') _deleted!: boolean;

  // ==================== Associations ====================

  @relation('decisions', 'decision_id') decision!: Relation<Decision>;
  @children('factor_scores') factorScores!: Query<FactorScore>;

  // ==================== Readonly Fields ====================

  @readonly @date('created_at') readonly createdAtReadonly!: Date;

  // ==================== Computed Properties ====================

  /**
   * Get the number of factor scores for this option
   */
  get scoreCount(): number {
    return this.factorScores.fetch().then(scores => scores.length);
  }

  /**
   * Check if all factors have been scored
   */
  async isFullyScored(): Promise<boolean> {
    const decision = await this.decision.fetch();
    const factors = await decision.factors.fetch();
    const scores = await this.factorScores.fetch();

    return scores.length === factors.length;
  }

  /**
   * Get utility score as percentage (0-100%)
   */
  get utilityPercentage(): number | undefined {
    if (this.computedUtility === undefined) return undefined;
    return Math.round(this.computedUtility * 100);
  }

  /**
   * Get satisfaction prediction as text
   */
  get satisfactionLabel(): string | undefined {
    if (this.predictedSatisfaction === undefined) return undefined;

    if (this.predictedSatisfaction < 2) return 'Very Low';
    if (this.predictedSatisfaction < 4) return 'Low';
    if (this.predictedSatisfaction < 7) return 'Medium';
    if (this.predictedSatisfaction < 9) return 'High';
    return 'Very High';
  }

  // ==================== Business Logic ====================

  /**
   * Compute the weighted utility score for this option
   * Based on Multi-Attribute Utility Theory (MAUT)
   */
  async computeUtility(): Promise<number> {
    const decision = await this.decision.fetch();
    const factors = await decision.factors.fetch();
    const scores = await this.factorScores.fetch();

    // Validate: All factors must be scored
    if (scores.length !== factors.length) {
      throw new Error(`Option "${this.name}" is not fully scored (${scores.length}/${factors.length} factors)`);
    }

    // Compute weighted sum: Σ(weight_i × score_i)
    let totalUtility = 0;

    for (const factor of factors) {
      const score = scores.find(s => s.factorId === factor.id);
      if (!score) {
        throw new Error(`Missing score for factor "${factor.name}" in option "${this.name}"`);
      }

      // Normalize score (1-5) to [0, 1]
      const normalizedScore = (score.score - 1) / 4;
      totalUtility += factor.weight * normalizedScore;
    }

    // Update computed utility
    await this.update(option => {
      option.computedUtility = totalUtility;
    });

    return totalUtility;
  }

  /**
   * Select this option (mark as chosen)
   */
  async select(): Promise<void> {
    await this.collections.get<Option>('options').query().fetch().then(async options => {
      // Batch update: unselect all other options in this decision
      await this.database.write(async () => {
        for (const option of options) {
          if (option.decisionId === this.decisionId) {
            await option.update(opt => {
              opt.isSelected = (opt.id === this.id);
            });
          }
        }
      });
    });
  }

  /**
   * Validate option data
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Option name cannot be empty');
    }

    if (this.name.length > 100) {
      errors.push('Option name must be ≤100 characters');
    }

    if (this.predictedSatisfaction !== undefined) {
      if (this.predictedSatisfaction < 0 || this.predictedSatisfaction > 10) {
        errors.push('Predicted satisfaction must be between 0 and 10');
      }
    }

    if (this.computedUtility !== undefined) {
      if (this.computedUtility < 0 || this.computedUtility > 1) {
        errors.push('Computed utility must be between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get prediction accuracy (if outcome has been logged)
   */
  async getPredictionAccuracy(): Promise<number | null> {
    if (this.predictedSatisfaction === undefined || !this.isSelected) {
      return null;
    }

    const decision = await this.decision.fetch();
    const outcomes = await decision.outcomes.fetch();

    if (outcomes.length === 0) {
      return null;
    }

    // Use the most recent outcome
    const latestOutcome = outcomes.sort((a, b) =>
      b.loggedAt.getTime() - a.loggedAt.getTime()
    )[0];

    // Calculate prediction error (lower is better)
    const error = Math.abs(this.predictedSatisfaction - latestOutcome.actualSatisfaction);

    // Convert to accuracy percentage (10 - error) / 10
    const accuracy = Math.max(0, (10 - error) / 10);

    return accuracy;
  }

  /**
   * Prepare option for LLM onboarding (minimal data)
   */
  toJSON(): { name: string; description?: string } {
    return {
      name: this.name,
      description: this.description,
    };
  }
}
