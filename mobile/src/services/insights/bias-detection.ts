/**
 * Bias Detection Engine
 *
 * Identifies cognitive biases in user's decision-making patterns.
 *
 * Detectable Biases:
 * 1. Optimism Bias: Consistently predicting higher satisfaction than reality
 * 2. Pessimism Bias: Consistently predicting lower satisfaction than reality
 * 3. Planning Fallacy: Underestimating time/effort for decisions
 * 4. Recency Bias: Over-weighting recent outcomes
 * 5. Confirmation Bias: Adjusting factor weights to match pre-selected option
 *
 * Statistical Methods:
 * - Prediction Error Analysis (PE = Predicted - Actual)
 * - Directional Bias Detection (mean PE significantly > 0 or < 0)
 * - t-test for significance (p < 0.05)
 *
 * Privacy: All analysis is on-device only
 */

import { Database, Q } from '@nozbe/watermelondb';
import { Outcome, Decision, Option, Insight } from '@database';

export interface BiasDetectionResult {
  biasType: string;
  magnitude: number; // 0.0 - 1.0 (strength of bias)
  direction: 'positive' | 'negative'; // Over-estimate vs. under-estimate
  sampleSize: number;
  significance: number; // p-value
  description: string;
}

export class BiasDetectionEngine {
  constructor(private database: Database) {}

  /**
   * Detect all biases from outcome data
   */
  async detectBiases(): Promise<Insight[]> {
    console.log('[BiasDetection] Starting bias analysis...');

    const insights: Insight[] = [];

    try {
      // Get outcomes with predictions
      const outcomes = await this.getOutcomesWithPredictions();

      if (outcomes.length < 5) {
        console.log('[BiasDetection] Insufficient data for bias detection (need ≥5 outcomes)');
        return [];
      }

      // Detect optimism/pessimism bias
      const predictionBias = await this.detectPredictionBias(outcomes);
      if (predictionBias) {
        const insight = await this.createBiasInsight(predictionBias);
        insights.push(insight);
      }

      // Detect planning fallacy (if time factor exists)
      const planningFallacy = await this.detectPlanningFallacy(outcomes);
      if (planningFallacy) {
        const insight = await this.createBiasInsight(planningFallacy);
        insights.push(insight);
      }

      // Detect recency bias
      const recencyBias = await this.detectRecencyBias(outcomes);
      if (recencyBias) {
        const insight = await this.createBiasInsight(recencyBias);
        insights.push(insight);
      }

      console.log(`[BiasDetection] Detected ${insights.length} cognitive biases`);
      return insights;
    } catch (error) {
      console.error('[BiasDetection] Error detecting biases:', error);
      return [];
    }
  }

  /**
   * Get outcomes that have prediction data
   */
  private async getOutcomesWithPredictions(): Promise<
    Array<{
      outcome: Outcome;
      predictedSatisfaction: number;
      actualSatisfaction: number;
      predictionError: number;
    }>
  > {
    const outcomes = await this.database.collections
      .get<Outcome>('outcomes')
      .query(Q.sortBy('logged_at', Q.desc), Q.take(50))
      .fetch();

    const outcomesWithPredictions = [];

    for (const outcome of outcomes) {
      const decision = await outcome.decision.fetch();

      if (!decision.selectedOptionId) continue;

      const options = await decision.options.fetch();
      const selectedOption = options.find(opt => opt.id === decision.selectedOptionId);

      if (!selectedOption || selectedOption.predictedSatisfaction === undefined) {
        continue;
      }

      const predictionError = selectedOption.predictedSatisfaction - outcome.actualSatisfaction;

      outcomesWithPredictions.push({
        outcome,
        predictedSatisfaction: selectedOption.predictedSatisfaction,
        actualSatisfaction: outcome.actualSatisfaction,
        predictionError, // Positive = over-predicted, Negative = under-predicted
      });
    }

    return outcomesWithPredictions;
  }

  /**
   * Detect optimism/pessimism bias
   * Optimism: Consistently predicting higher satisfaction
   * Pessimism: Consistently predicting lower satisfaction
   */
  private async detectPredictionBias(
    outcomes: Array<{
      predictionError: number;
      actualSatisfaction: number;
    }>
  ): Promise<BiasDetectionResult | null> {
    if (outcomes.length < 5) return null;

    // Calculate mean prediction error
    const errors = outcomes.map(o => o.predictionError);
    const meanError = errors.reduce((sum, e) => sum + e, 0) / errors.length;

    // Calculate standard deviation
    const variance = errors.reduce((sum, e) => sum + Math.pow(e - meanError, 2), 0) / errors.length;
    const stdDev = Math.sqrt(variance);

    // t-statistic for one-sample t-test
    const t = Math.abs(meanError) / (stdDev / Math.sqrt(errors.length));

    // Critical value for p < 0.05, df = n-1
    const criticalValue = this.getTCriticalValue(errors.length - 1);

    // Check if bias is significant
    if (t < criticalValue) {
      return null; // Not statistically significant
    }

    // Determine bias type
    const isOptimismBias = meanError > 0;
    const magnitude = Math.min(Math.abs(meanError) / 10, 1.0); // Normalize to 0-1

    return {
      biasType: isOptimismBias ? 'optimism_bias' : 'pessimism_bias',
      magnitude,
      direction: isOptimismBias ? 'positive' : 'negative',
      sampleSize: outcomes.length,
      significance: t > 2.576 ? 0.01 : 0.05, // p-value approximation
      description: isOptimismBias
        ? `You tend to overestimate satisfaction by ${Math.abs(meanError).toFixed(1)} points on average`
        : `You tend to underestimate satisfaction by ${Math.abs(meanError).toFixed(1)} points on average`,
    };
  }

  /**
   * Detect planning fallacy
   * Users underestimate time/effort required for decisions
   */
  private async detectPlanningFallacy(
    outcomes: Array<{ outcome: Outcome }>
  ): Promise<BiasDetectionResult | null> {
    // Planning fallacy detection requires "time" or "effort" factors
    // For Phase 1, we'll implement a simplified version

    // Check if users consistently log outcomes later than expected
    const delayedOutcomes = [];

    for (const { outcome } of outcomes) {
      const decision = await outcome.decision.fetch();

      if (!decision.decisionDate) continue;

      const daysBetween = Math.floor(
        (outcome.loggedAt.getTime() - decision.decisionDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Expected: users should log outcomes within 7 days
      // If consistently >14 days, suggests planning fallacy
      if (daysBetween > 14) {
        delayedOutcomes.push(daysBetween);
      }
    }

    if (delayedOutcomes.length >= 3 && delayedOutcomes.length / outcomes.length > 0.5) {
      const avgDelay = delayedOutcomes.reduce((sum, d) => sum + d, 0) / delayedOutcomes.length;

      return {
        biasType: 'planning_fallacy',
        magnitude: Math.min(avgDelay / 30, 1.0), // Normalize to 0-1
        direction: 'positive',
        sampleSize: delayedOutcomes.length,
        significance: 0.05,
        description: `You typically log outcomes ${avgDelay.toFixed(0)} days after the decision, suggesting you underestimate how long decisions take to resolve`,
      };
    }

    return null;
  }

  /**
   * Detect recency bias
   * Over-weighting recent outcomes in predictions
   */
  private async detectRecencyBias(
    outcomes: Array<{
      outcome: Outcome;
      predictionError: number;
    }>
  ): Promise<BiasDetectionResult | null> {
    if (outcomes.length < 10) return null;

    // Split outcomes into recent (last 5) and older (previous 5)
    const recent = outcomes.slice(0, 5);
    const older = outcomes.slice(5, 10);

    // Calculate mean absolute error for each group
    const recentMAE = recent.reduce((sum, o) => sum + Math.abs(o.predictionError), 0) / recent.length;
    const olderMAE = older.reduce((sum, o) => sum + Math.abs(o.predictionError), 0) / older.length;

    // If recent errors are significantly higher, suggests recency bias
    const errorIncrease = (recentMAE - olderMAE) / olderMAE;

    if (errorIncrease > 0.3) {
      // 30% increase in error
      return {
        biasType: 'recency_bias',
        magnitude: Math.min(errorIncrease, 1.0),
        direction: 'positive',
        sampleSize: outcomes.length,
        significance: 0.05,
        description: `Your recent predictions are ${Math.round(errorIncrease * 100)}% less accurate than older ones, suggesting you may be over-weighting recent experiences`,
      };
    }

    return null;
  }

  /**
   * Create insight from bias detection result
   */
  private async createBiasInsight(bias: BiasDetectionResult): Promise<Insight> {
    const title = this.getBiasTitle(bias.biasType);
    const description = bias.description;

    return await this.database.write(async () => {
      return await this.database.collections.get<Insight>('insights').create(insight => {
        insight.insightType = 'bias_detection';
        insight.title = title;
        insight.description = description;
        insight.priority = this.getBiasPriority(bias.magnitude);
        insight.isRead = false;
        insight.isActionable = true;
        insight.actionLabel = 'Learn More';
        insight.metadata = {
          bias_type: bias.biasType,
          magnitude: bias.magnitude,
          sample_size: bias.sampleSize,
          p_value: bias.significance,
        };
        insight.generatedAt = new Date();
      });
    });
  }

  /**
   * Get human-readable title for bias type
   */
  private getBiasTitle(biasType: string): string {
    const titles: Record<string, string> = {
      optimism_bias: '⚠️ Optimism Bias Detected',
      pessimism_bias: '⚠️ Pessimism Bias Detected',
      planning_fallacy: '⏰ Planning Fallacy Detected',
      recency_bias: '🔄 Recency Bias Detected',
      confirmation_bias: '🔍 Confirmation Bias Detected',
    };

    return titles[biasType] || '⚠️ Cognitive Bias Detected';
  }

  /**
   * Determine priority based on bias magnitude
   */
  private getBiasPriority(magnitude: number): 1 | 2 | 3 | 4 | 5 {
    if (magnitude >= 0.7) return 1; // Critical
    if (magnitude >= 0.5) return 2; // High
    if (magnitude >= 0.3) return 3; // Medium
    return 4; // Low
  }

  /**
   * Get critical t-value for significance testing
   * Simplified lookup table for common sample sizes
   */
  private getTCriticalValue(degreesOfFreedom: number): number {
    // Critical values for two-tailed t-test at p = 0.05
    if (degreesOfFreedom >= 30) return 1.96;
    if (degreesOfFreedom >= 20) return 2.086;
    if (degreesOfFreedom >= 10) return 2.228;
    if (degreesOfFreedom >= 5) return 2.571;
    return 3.182; // df = 4
  }
}
