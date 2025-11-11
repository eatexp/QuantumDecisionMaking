import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, relation, readonly } from '@nozbe/watermelondb/decorators';
import { Option } from './Option';
import { Factor } from './Factor';

/**
 * FactorScore Model
 *
 * Represents the score (1-5) of a specific option on a specific factor.
 * This is the "many-to-many" join table between options and factors.
 *
 * Example: Option "Job A" scores 4/5 on Factor "Salary"
 *
 * Privacy: Scores reveal user's evaluation → encrypted at rest
 */

export class FactorScore extends Model {
  static table = 'factor_scores';

  static associations = {
    options: { type: 'belongs_to' as const, key: 'option_id' },
    factors: { type: 'belongs_to' as const, key: 'factor_id' },
  };

  // ==================== Fields ====================

  @field('option_id') optionId!: string;
  @field('factor_id') factorId!: string;
  @field('score') score!: number; // 1-5 (Likert scale)
  @field('notes') notes?: string; // Optional justification
  @field('confidence') confidence?: number; // 0.0 - 1.0 (optional uncertainty)

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('_deleted') _deleted!: boolean;

  // ==================== Associations ====================

  @relation('options', 'option_id') option!: Relation<Option>;
  @relation('factors', 'factor_id') factor!: Relation<Factor>;

  // ==================== Readonly Fields ====================

  @readonly @date('created_at') readonly createdAtReadonly!: Date;

  // ==================== Computed Properties ====================

  /**
   * Normalize score to [0, 1] range (for utility calculation)
   */
  get normalizedScore(): number {
    return (this.score - 1) / 4;
  }

  /**
   * Get score as percentage (0-100%)
   */
  get scorePercentage(): number {
    return Math.round(this.normalizedScore * 100);
  }

  /**
   * Get score label
   */
  get scoreLabel(): 'Very Poor' | 'Poor' | 'Fair' | 'Good' | 'Excellent' {
    if (this.score <= 1) return 'Very Poor';
    if (this.score <= 2) return 'Poor';
    if (this.score <= 3) return 'Fair';
    if (this.score <= 4) return 'Good';
    return 'Excellent';
  }

  /**
   * Check if user is confident about this score
   */
  get isConfident(): boolean {
    if (this.confidence === undefined) return true; // Default: confident
    return this.confidence >= 0.7;
  }

  /**
   * Get confidence label
   */
  get confidenceLabel(): 'Very Uncertain' | 'Uncertain' | 'Moderate' | 'Confident' | 'Very Confident' | undefined {
    if (this.confidence === undefined) return undefined;

    if (this.confidence < 0.2) return 'Very Uncertain';
    if (this.confidence < 0.4) return 'Uncertain';
    if (this.confidence < 0.6) return 'Moderate';
    if (this.confidence < 0.8) return 'Confident';
    return 'Very Confident';
  }

  // ==================== Business Logic ====================

  /**
   * Update score with timestamp
   */
  async updateScore(newScore: number, notes?: string, confidence?: number): Promise<void> {
    const validation = this.validateScore(newScore, confidence);
    if (!validation.valid) {
      throw new Error(`Invalid score update: ${validation.errors.join(', ')}`);
    }

    await this.update(factorScore => {
      factorScore.score = newScore;
      factorScore.updatedAt = new Date();

      if (notes !== undefined) {
        factorScore.notes = notes;
      }

      if (confidence !== undefined) {
        factorScore.confidence = confidence;
      }
    });
  }

  /**
   * Calculate weighted contribution to option's utility
   */
  async getWeightedContribution(): Promise<number> {
    const factor = await this.factor.fetch();
    return this.normalizedScore * factor.weight;
  }

  /**
   * Compare this score to other options on the same factor
   * Returns: { higherCount, lowerCount, rank }
   */
  async compareToOtherOptions(): Promise<{
    higherCount: number;
    lowerCount: number;
    rank: number;
    isHighest: boolean;
  }> {
    const factor = await this.factor.fetch();
    const allScores = await factor.factorScores.fetch();

    const higherCount = allScores.filter(s => s.score > this.score && s.id !== this.id).length;
    const lowerCount = allScores.filter(s => s.score < this.score && s.id !== this.id).length;
    const rank = higherCount + 1; // 1-based rank
    const isHighest = higherCount === 0;

    return { higherCount, lowerCount, rank, isHighest };
  }

  /**
   * Check if this score is aligned with factor preference
   * For "higher_is_better" factors, higher scores are better
   * For "lower_is_better" factors, lower scores are better
   */
  async isAlignedWithPreference(): Promise<boolean> {
    const factor = await this.factor.fetch();

    switch (factor.preference) {
      case 'higher_is_better':
        return this.score >= 4; // Good or Excellent
      case 'lower_is_better':
        return this.score <= 2; // Very Poor or Poor (which is good for "lower is better")
      case 'neutral':
        return true; // No preference direction
      default:
        return true;
    }
  }

  /**
   * Validate score data
   */
  validateScore(score?: number, confidence?: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const scoreToValidate = score !== undefined ? score : this.score;
    const confidenceToValidate = confidence !== undefined ? confidence : this.confidence;

    // Score must be 1-5 (Likert scale)
    if (scoreToValidate < 1 || scoreToValidate > 5) {
      errors.push('Score must be between 1 and 5');
    }

    // Score should be an integer (no decimals)
    if (!Number.isInteger(scoreToValidate)) {
      errors.push('Score must be an integer (1, 2, 3, 4, or 5)');
    }

    // Confidence (if provided) must be 0.0 - 1.0
    if (confidenceToValidate !== undefined) {
      if (confidenceToValidate < 0 || confidenceToValidate > 1) {
        errors.push('Confidence must be between 0 and 1');
      }
    }

    // Notes (if provided) should have reasonable length
    if (this.notes && this.notes.length > 500) {
      errors.push('Notes must be ≤500 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate full record
   */
  validate(): { valid: boolean; errors: string[] } {
    return this.validateScore();
  }

  /**
   * Get age of score (useful for detecting stale data)
   */
  get ageInDays(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.updatedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if score is stale (>7 days old)
   */
  get isStale(): boolean {
    return this.ageInDays > 7;
  }

  /**
   * Create a copy of this score for a different option (useful for templates)
   */
  async copyTo(targetOptionId: string): Promise<FactorScore> {
    return await this.database.write(async () => {
      return await this.collections.get<FactorScore>('factor_scores').create(factorScore => {
        factorScore.optionId = targetOptionId;
        factorScore.factorId = this.factorId;
        factorScore.score = this.score;
        factorScore.notes = this.notes;
        factorScore.confidence = this.confidence;
        factorScore.createdAt = new Date();
        factorScore.updatedAt = new Date();
      });
    });
  }

  /**
   * Prepare for export (minimal data)
   */
  async toJSON(): Promise<{
    factorName: string;
    optionName: string;
    score: number;
    scoreLabel: string;
    notes?: string;
  }> {
    const factor = await this.factor.fetch();
    const option = await this.option.fetch();

    return {
      factorName: factor.name,
      optionName: option.name,
      score: this.score,
      scoreLabel: this.scoreLabel,
      notes: this.notes,
    };
  }
}
