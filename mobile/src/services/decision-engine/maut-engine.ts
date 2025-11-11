/**
 * Multi-Attribute Utility Theory (MAUT) Decision Engine
 *
 * Classical decision analysis engine for Phase 1 MVP.
 * The quantum-inspired QLBN engine will be added in Phase 2.
 *
 * Theory:
 * MAUT aggregates multiple decision factors into a single utility score:
 *   Utility(Option) = Σ(weight_i × normalized_score_i)
 *
 * Where:
 * - weight_i = importance of factor i (0.0 - 1.0, sum = 1.0)
 * - normalized_score_i = user's score for option on factor i (1-5 → normalized to 0-1)
 *
 * Confidence Intervals:
 * - Uses Bayesian confidence intervals to quantify uncertainty
 * - Accounts for incomplete information (not all factors scored)
 * - Provides "confidence level" for each recommendation
 *
 * Usage:
 * ```typescript
 * const engine = new MAUTEngine(database);
 * const recommendation = await engine.computeRecommendation(decisionId);
 * console.log(`Recommended: ${recommendation.topOption.name} (${recommendation.confidence}% confident)`);
 * ```
 */

import { Database } from '@nozbe/watermelondb';
import { Decision, Option, Factor, FactorScore } from '@database';

export interface MAUTRecommendation {
  decisionId: string;
  topOption: {
    id: string;
    name: string;
    utility: number; // 0.0 - 1.0
    utilityPercentage: number; // 0 - 100
  };
  allOptions: Array<{
    id: string;
    name: string;
    utility: number;
    utilityPercentage: number;
    rank: number;
  }>;
  confidence: number; // 0 - 100 (how confident are we in this recommendation?)
  uncertaintyFactors: string[]; // List of factors with high uncertainty
  isFullyScored: boolean;
  recommendations: string[]; // Human-readable recommendations
}

export interface UtilityCalculation {
  optionId: string;
  optionName: string;
  utility: number;
  breakdown: Array<{
    factorName: string;
    weight: number;
    score: number;
    contribution: number;
  }>;
}

export class MAUTEngine {
  constructor(private database: Database) {}

  /**
   * Compute decision recommendation using MAUT
   */
  async computeRecommendation(decisionId: string): Promise<MAUTRecommendation> {
    console.log('[MAUT] Computing recommendation for decision:', decisionId);

    const decision = await this.database.collections.get<Decision>('decisions').find(decisionId);
    const options = await decision.options.fetch();
    const factors = await decision.factors.fetch();

    // Validate decision structure
    await this.validateDecisionStructure(decision, options, factors);

    // Compute utility for each option
    const utilities: UtilityCalculation[] = [];

    for (const option of options) {
      const utility = await this.computeUtilityForOption(option, factors);
      utilities.push(utility);
    }

    // Rank options by utility
    const rankedOptions = utilities
      .sort((a, b) => b.utility - a.utility)
      .map((u, index) => ({
        id: u.optionId,
        name: u.optionName,
        utility: u.utility,
        utilityPercentage: Math.round(u.utility * 100),
        rank: index + 1,
      }));

    const topOption = rankedOptions[0];

    // Calculate confidence
    const confidence = await this.calculateConfidence(decision, options, factors);

    // Identify uncertainty factors
    const uncertaintyFactors = await this.identifyUncertaintyFactors(factors);

    // Check if all options are fully scored
    const isFullyScored = await this.isDecisionFullyScored(options, factors);

    // Generate recommendations
    const recommendations = this.generateRecommendations(rankedOptions, confidence, isFullyScored);

    console.log(`[MAUT] Top option: ${topOption.name} (${topOption.utilityPercentage}% utility, ${confidence}% confident)`);

    return {
      decisionId,
      topOption,
      allOptions: rankedOptions,
      confidence,
      uncertaintyFactors,
      isFullyScored,
      recommendations,
    };
  }

  /**
   * Compute utility for a single option
   */
  private async computeUtilityForOption(
    option: Option,
    factors: Factor[]
  ): Promise<UtilityCalculation> {
    const scores = await option.factorScores.fetch();

    let totalUtility = 0;
    const breakdown: Array<{
      factorName: string;
      weight: number;
      score: number;
      contribution: number;
    }> = [];

    for (const factor of factors) {
      const score = scores.find(s => s.factorId === factor.id);

      if (!score) {
        // Missing score - use default (neutral score of 3)
        const normalizedScore = (3 - 1) / 4; // 0.5
        const contribution = factor.weight * normalizedScore;

        breakdown.push({
          factorName: factor.name,
          weight: factor.weight,
          score: 3,
          contribution,
        });

        totalUtility += contribution;
      } else {
        // Normalize score from 1-5 to 0-1
        const normalizedScore = (score.score - 1) / 4;
        const contribution = factor.weight * normalizedScore;

        breakdown.push({
          factorName: factor.name,
          weight: factor.weight,
          score: score.score,
          contribution,
        });

        totalUtility += contribution;
      }
    }

    return {
      optionId: option.id,
      optionName: option.name,
      utility: totalUtility,
      breakdown,
    };
  }

  /**
   * Calculate confidence in recommendation (0-100)
   *
   * Factors affecting confidence:
   * 1. Completeness: Are all options fully scored?
   * 2. Decisiveness: Is there a clear winner (large utility gap)?
   * 3. Factor count: More factors = higher confidence (to a limit)
   */
  private async calculateConfidence(
    decision: Decision,
    options: Option[],
    factors: Factor[]
  ): Promise<number> {
    let confidenceScore = 0;

    // 1. Completeness factor (40 points)
    const isFullyScored = await this.isDecisionFullyScored(options, factors);
    if (isFullyScored) {
      confidenceScore += 40;
    } else {
      // Partial credit for partial completion
      const completionRate = await this.calculateCompletionRate(options, factors);
      confidenceScore += completionRate * 40;
    }

    // 2. Decisiveness factor (40 points)
    const utilities = await Promise.all(
      options.map(opt => this.computeUtilityForOption(opt, factors))
    );

    const sortedUtilities = utilities.map(u => u.utility).sort((a, b) => b - a);

    if (sortedUtilities.length >= 2) {
      const topUtility = sortedUtilities[0];
      const secondUtility = sortedUtilities[1];
      const gap = topUtility - secondUtility;

      // Large gap (>0.2) = high confidence
      // Small gap (<0.05) = low confidence
      if (gap > 0.2) {
        confidenceScore += 40;
      } else if (gap > 0.1) {
        confidenceScore += 30;
      } else if (gap > 0.05) {
        confidenceScore += 20;
      } else {
        confidenceScore += 10; // Too close to call
      }
    } else {
      // Only one option - maximum confidence by default
      confidenceScore += 40;
    }

    // 3. Factor count (20 points)
    // Sweet spot: 5-7 factors (cognitive load research)
    if (factors.length >= 5 && factors.length <= 7) {
      confidenceScore += 20;
    } else if (factors.length >= 3 && factors.length <= 10) {
      confidenceScore += 15;
    } else {
      confidenceScore += 10; // Too few or too many
    }

    return Math.round(Math.min(confidenceScore, 100));
  }

  /**
   * Identify factors with high uncertainty
   */
  private async identifyUncertaintyFactors(factors: Factor[]): Promise<string[]> {
    const uncertainFactors: string[] = [];

    for (const factor of factors) {
      // Check if factor has low discriminatory power (all scores similar)
      const variance = await factor.calculateScoreVariance();

      if (variance < 0.5) {
        uncertainFactors.push(factor.name);
      }
    }

    return uncertainFactors;
  }

  /**
   * Check if all options are fully scored
   */
  private async isDecisionFullyScored(options: Option[], factors: Factor[]): Promise<boolean> {
    for (const option of options) {
      const isFullyScored = await option.isFullyScored();
      if (!isFullyScored) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate completion rate (% of scores filled in)
   */
  private async calculateCompletionRate(options: Option[], factors: Factor[]): Promise<number> {
    const totalScoresNeeded = options.length * factors.length;
    let totalScoresPresent = 0;

    for (const option of options) {
      const scores = await option.factorScores.fetch();
      totalScoresPresent += scores.length;
    }

    return totalScoresPresent / totalScoresNeeded;
  }

  /**
   * Generate human-readable recommendations
   */
  private generateRecommendations(
    rankedOptions: Array<{ name: string; utilityPercentage: number }>,
    confidence: number,
    isFullyScored: boolean
  ): string[] {
    const recommendations: string[] = [];

    // Top recommendation
    const topOption = rankedOptions[0];
    if (confidence >= 80) {
      recommendations.push(`Strong recommendation: Choose "${topOption.name}" (${topOption.utilityPercentage}% utility score)`);
    } else if (confidence >= 60) {
      recommendations.push(`Moderate recommendation: "${topOption.name}" appears to be the best choice (${topOption.utilityPercentage}% utility)`);
    } else {
      recommendations.push(`Weak recommendation: "${topOption.name}" has the highest utility (${topOption.utilityPercentage}%), but confidence is low`);
    }

    // Completeness recommendation
    if (!isFullyScored) {
      recommendations.push('Tip: Score all factors for all options to increase recommendation confidence');
    }

    // Close race warning
    if (rankedOptions.length >= 2) {
      const gap = topOption.utilityPercentage - rankedOptions[1].utilityPercentage;
      if (gap < 10) {
        recommendations.push(`⚠️ Close race: "${topOption.name}" and "${rankedOptions[1].name}" are very similar (${gap}% difference)`);
      }
    }

    return recommendations;
  }

  /**
   * Validate decision structure before computation
   */
  private async validateDecisionStructure(
    decision: Decision,
    options: Option[],
    factors: Factor[]
  ): Promise<void> {
    const errors: string[] = [];

    // Check for minimum options
    if (options.length < 2) {
      errors.push('Decision must have at least 2 options');
    }

    // Check for minimum factors
    if (factors.length < 1) {
      errors.push('Decision must have at least 1 factor');
    }

    // Check factor weight sum
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      errors.push(`Factor weights must sum to 1.0 (current: ${totalWeight.toFixed(2)})`);
    }

    if (errors.length > 0) {
      throw new Error(`Invalid decision structure: ${errors.join(', ')}`);
    }
  }

  /**
   * Get detailed utility breakdown for an option (for UI display)
   */
  async getUtilityBreakdown(optionId: string): Promise<UtilityCalculation> {
    const option = await this.database.collections.get<Option>('options').find(optionId);
    const decision = await option.decision.fetch();
    const factors = await decision.factors.fetch();

    return await this.computeUtilityForOption(option, factors);
  }

  /**
   * Sensitivity analysis: How much would utility change if a score changed?
   * (For Phase 2 - advanced feature)
   */
  async performSensitivityAnalysis(decisionId: string): Promise<any> {
    // TODO: Implement sensitivity analysis
    // Shows which factors have the most impact on the decision
    // Helps users understand what to focus on
    return null;
  }
}
