/**
 * Accuracy Tracking Engine
 *
 * Tracks how accurately users predict their own satisfaction.
 * This is THE CORE METRIC for validating the decision engine's value.
 *
 * Metrics Tracked:
 * 1. Overall Accuracy: % of predictions within 2 points of actual
 * 2. Mean Absolute Error (MAE): Average prediction error
 * 3. Accuracy by Decision Type: Career vs. Personal vs. Financial
 * 4. Accuracy Trend: Improving over time?
 * 5. Calibration: Are high-confidence predictions more accurate?
 *
 * Gamification Integration:
 * - Accuracy Score (0-100): Displayed in user profile
 * - Accuracy Badges: "Accurate Predictor" (70%+), "Prediction Master" (90%+)
 * - Streaks: N consecutive accurate predictions
 *
 * Privacy: All tracking is on-device only
 */

import { Database, Q } from '@nozbe/watermelondb';
import { Outcome, Decision, Option, Insight, UserStat } from '@database';

export interface AccuracyMetrics {
  totalPredictions: number;
  correctPredictions: number; // Within 2 points
  accuracyPercentage: number; // 0-100
  meanAbsoluteError: number; // Average |predicted - actual|
  medianAbsoluteError: number;
  trend: 'improving' | 'declining' | 'stable';
}

export class AccuracyTrackingEngine {
  constructor(private database: Database) {}

  /**
   * Generate accuracy insights
   */
  async generateAccuracyInsights(): Promise<Insight[]> {
    console.log('[AccuracyTracking] Starting accuracy analysis...');

    const insights: Insight[] = [];

    try {
      // Get outcomes with predictions
      const outcomes = await this.getOutcomesWithPredictions();

      if (outcomes.length < 3) {
        console.log('[AccuracyTracking] Insufficient data (need ≥3 outcomes with predictions)');
        return [];
      }

      // Calculate accuracy metrics
      const metrics = this.calculateAccuracyMetrics(outcomes);

      // Update UserStat with accuracy data
      await this.updateUserStatAccuracy(metrics);

      // Generate insights based on metrics
      const accuracyInsight = await this.createAccuracyInsight(metrics);
      insights.push(accuracyInsight);

      // Check for accuracy milestones (badges)
      if (metrics.accuracyPercentage >= 70 && outcomes.length >= 5) {
        const milestoneInsight = await this.createMilestoneInsight(metrics);
        insights.push(milestoneInsight);
      }

      // Check for accuracy trends
      if (metrics.trend === 'improving' && outcomes.length >= 10) {
        const trendInsight = await this.createTrendInsight(metrics);
        insights.push(trendInsight);
      }

      console.log(`[AccuracyTracking] Generated ${insights.length} accuracy insights`);
      return insights;
    } catch (error) {
      console.error('[AccuracyTracking] Error generating accuracy insights:', error);
      return [];
    }
  }

  /**
   * Get outcomes that have prediction data
   */
  private async getOutcomesWithPredictions(): Promise<
    Array<{
      outcome: Outcome;
      decision: Decision;
      predictedSatisfaction: number;
      actualSatisfaction: number;
      error: number;
      isAccurate: boolean;
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

      const error = Math.abs(selectedOption.predictedSatisfaction - outcome.actualSatisfaction);
      const isAccurate = error <= 2.0; // Within 2 points is "accurate"

      outcomesWithPredictions.push({
        outcome,
        decision,
        predictedSatisfaction: selectedOption.predictedSatisfaction,
        actualSatisfaction: outcome.actualSatisfaction,
        error,
        isAccurate,
      });
    }

    return outcomesWithPredictions;
  }

  /**
   * Calculate accuracy metrics
   */
  private calculateAccuracyMetrics(
    outcomes: Array<{
      error: number;
      isAccurate: boolean;
      outcome: Outcome;
    }>
  ): AccuracyMetrics {
    const totalPredictions = outcomes.length;
    const correctPredictions = outcomes.filter(o => o.isAccurate).length;
    const accuracyPercentage = (correctPredictions / totalPredictions) * 100;

    // Mean Absolute Error
    const meanAbsoluteError = outcomes.reduce((sum, o) => sum + o.error, 0) / totalPredictions;

    // Median Absolute Error
    const sortedErrors = outcomes.map(o => o.error).sort((a, b) => a - b);
    const medianAbsoluteError =
      totalPredictions % 2 === 0
        ? (sortedErrors[totalPredictions / 2 - 1] + sortedErrors[totalPredictions / 2]) / 2
        : sortedErrors[Math.floor(totalPredictions / 2)];

    // Trend analysis (recent vs. older)
    const trend = this.calculateTrend(outcomes);

    return {
      totalPredictions,
      correctPredictions,
      accuracyPercentage,
      meanAbsoluteError,
      medianAbsoluteError,
      trend,
    };
  }

  /**
   * Calculate accuracy trend (improving, declining, stable)
   */
  private calculateTrend(
    outcomes: Array<{ error: number }>
  ): 'improving' | 'declining' | 'stable' {
    if (outcomes.length < 6) return 'stable';

    // Compare recent (last 3) vs. older (previous 3)
    const recent = outcomes.slice(0, 3);
    const older = outcomes.slice(3, 6);

    const recentMAE = recent.reduce((sum, o) => sum + o.error, 0) / recent.length;
    const olderMAE = older.reduce((sum, o) => sum + o.error, 0) / older.length;

    const improvement = ((olderMAE - recentMAE) / olderMAE) * 100;

    if (improvement > 15) return 'improving'; // 15%+ improvement
    if (improvement < -15) return 'declining'; // 15%+ decline
    return 'stable';
  }

  /**
   * Update UserStat with accuracy data
   */
  private async updateUserStatAccuracy(metrics: AccuracyMetrics): Promise<void> {
    const userStat = await UserStat.getOrCreate(this.database);

    await userStat.updateAccuracy(
      metrics.totalPredictions,
      metrics.correctPredictions,
      metrics.meanAbsoluteError
    );
  }

  /**
   * Create accuracy insight
   */
  private async createAccuracyInsight(metrics: AccuracyMetrics): Promise<Insight> {
    const title = `🎯 Your Prediction Accuracy: ${Math.round(metrics.accuracyPercentage)}%`;

    let description = `You've made ${metrics.totalPredictions} predictions, and ${metrics.correctPredictions} were accurate (within 2 points). `;

    if (metrics.accuracyPercentage >= 70) {
      description += "Great job! You're learning to predict your satisfaction well.";
    } else if (metrics.accuracyPercentage >= 50) {
      description += "You're getting better at predicting outcomes. Keep logging!";
    } else {
      description += 'Your accuracy is improving as you log more outcomes.';
    }

    return await this.database.write(async () => {
      return await this.database.collections.get<Insight>('insights').create(insight => {
        insight.insightType = 'accuracy_tracking';
        insight.title = title;
        insight.description = description;
        insight.priority = 2; // High priority
        insight.isRead = false;
        insight.isActionable = false;
        insight.metadata = {
          accuracy_percentage: metrics.accuracyPercentage,
          total_predictions: metrics.totalPredictions,
          correct_predictions: metrics.correctPredictions,
          prediction_error: metrics.meanAbsoluteError,
        };
        insight.generatedAt = new Date();
      });
    });
  }

  /**
   * Create milestone insight (70%+ accuracy)
   */
  private async createMilestoneInsight(metrics: AccuracyMetrics): Promise<Insight> {
    const title = '🏆 Achievement: Accurate Predictor!';
    const description = `You've reached ${Math.round(metrics.accuracyPercentage)}% prediction accuracy across ${metrics.totalPredictions} decisions. You're learning to predict your own satisfaction!`;

    return await this.database.write(async () => {
      return await this.database.collections.get<Insight>('insights').create(insight => {
        insight.insightType = 'achievement';
        insight.title = title;
        insight.description = description;
        insight.priority = 3; // Medium priority
        insight.isRead = false;
        insight.isActionable = false;
        insight.metadata = {
          accuracy_percentage: metrics.accuracyPercentage,
          badge_name: 'accurate_predictor',
        };
        insight.generatedAt = new Date();
      });
    });
  }

  /**
   * Create trend insight (improving accuracy)
   */
  private async createTrendInsight(metrics: AccuracyMetrics): Promise<Insight> {
    const title = '📈 Your Predictions Are Improving!';
    const description = `Your recent predictions are more accurate than your earlier ones. The more you use the app, the better you get at predicting satisfaction.`;

    return await this.database.write(async () => {
      return await this.database.collections.get<Insight>('insights').create(insight => {
        insight.insightType = 'pattern';
        insight.title = title;
        insight.description = description;
        insight.priority = 3; // Medium priority
        insight.isRead = false;
        insight.isActionable = false;
        insight.metadata = {
          pattern_type: 'accuracy_improvement',
          confidence: 0.8,
        };
        insight.generatedAt = new Date();
      });
    });
  }

  /**
   * Calculate accuracy score for gamification (0-100)
   */
  async calculateAccuracyScore(): Promise<number> {
    const outcomes = await this.getOutcomesWithPredictions();

    if (outcomes.length === 0) return 0;

    const metrics = this.calculateAccuracyMetrics(outcomes);

    // Weighted score:
    // - 70% from accuracy percentage
    // - 30% from inverse MAE (lower error = higher score)

    const accuracyComponent = metrics.accuracyPercentage * 0.7;
    const errorComponent = Math.max(0, (10 - metrics.meanAbsoluteError) / 10) * 100 * 0.3;

    return Math.round(accuracyComponent + errorComponent);
  }

  /**
   * Get accuracy by decision category (for future enhancement)
   */
  async getAccuracyByCategory(): Promise<Record<string, AccuracyMetrics>> {
    // This would require decision categories to be implemented
    // For Phase 1, we'll return overall metrics only
    return {};
  }

  /**
   * Get accuracy calibration data
   * Checks if high-confidence predictions are actually more accurate
   */
  async getAccuracyCalibration(): Promise<{
    highConfidence: AccuracyMetrics;
    lowConfidence: AccuracyMetrics;
    isWellCalibrated: boolean;
  } | null> {
    // This requires confidence tracking on predictions
    // For Phase 1, we'll return null (feature for Phase 2)
    return null;
  }
}
