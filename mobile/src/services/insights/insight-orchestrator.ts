import { Database } from '@nozbe/watermelondb';
import { Outcome } from '@models/Outcome';
import { Insight } from '@models/Insight';
import { CorrelationDiscoveryEngine } from './correlation-discovery';
// import { BiasDetectionEngine } from './bias-detection';
// import { AccuracyTrackingEngine } from './accuracy-tracking';
// (These will be implemented similarly)

/**
 * Insight Orchestrator
 *
 * Central controller for the Insight-Driven Loop.
 *
 * CRITICAL: This is THE MOAT - the feature that prevents user abandonment.
 *
 * Flow:
 * 1. User logs outcome → This function is called
 * 2. All insight engines run in parallel (Promise.all)
 * 3. Insights are generated and stored in database
 * 4. UI displays insight cards (instant reward)
 *
 * Performance Budget: <2 seconds total (from outcome log to insight display)
 * Fallback Strategy: NEVER fail silently - always generate at least 1 insight
 *
 * Usage:
 * ```typescript
 * const orchestrator = new InsightOrchestrator(database);
 * const insights = await orchestrator.generateInsightsAfterOutcomeLog(outcome);
 * // Navigate to InsightFeedScreen with highlighted insights
 * ```
 */

export class InsightOrchestrator {
  private correlationEngine: CorrelationDiscoveryEngine;
  // private biasEngine: BiasDetectionEngine;
  // private accuracyEngine: AccuracyTrackingEngine;

  constructor(private database: Database) {
    this.correlationEngine = new CorrelationDiscoveryEngine(database);
    // this.biasEngine = new BiasDetectionEngine(database);
    // this.accuracyEngine = new AccuracyTrackingEngine(database);
  }

  /**
   * Generate insights after outcome logging
   *
   * This is the CRITICAL PATH for the Insight-Driven Loop.
   *
   * Performance Requirements:
   * - Must complete in <2 seconds (non-negotiable)
   * - Must generate ≥1 insight (fallback if engines fail)
   * - Must not throw errors (graceful degradation)
   *
   * @param outcome - The newly logged outcome that triggered this
   * @returns Array of generated insights (guaranteed ≥1)
   */
  async generateInsightsAfterOutcomeLog(outcome: Outcome): Promise<Insight[]> {
    const startTime = Date.now();
    console.log('[Insights] Generating insights after outcome log...');

    try {
      // Run all insight engines in parallel (Phase 1: Only correlation engine implemented)
      const [correlationInsights /* , biasInsights, accuracyInsight */] = await Promise.all([
        this.correlationEngine.discoverCorrelations().catch(err => {
          console.error('[Insights] Correlation engine failed:', err);
          return [];
        }),

        // Phase 1.5: Uncomment these as they're implemented
        // this.biasEngine.detectBiases().catch(err => {
        //   console.error('[Insights] Bias engine failed:', err);
        //   return [];
        // }),

        // this.accuracyEngine.computeAccuracyInsight().catch(err => {
        //   console.error('[Insights] Accuracy engine failed:', err);
        //   return null;
        // }),
      ]);

      // Combine all insights
      const allInsights: Insight[] = [
        ...correlationInsights,
        // ...(biasInsights || []),
        // ...(accuracyInsight ? [accuracyInsight] : []),
      ];

      // Performance check (CRITICAL)
      const elapsedTime = Date.now() - startTime;
      console.log(`[Insights] Generated ${allInsights.length} insights in ${elapsedTime}ms`);

      if (elapsedTime > 2000) {
        console.warn(`⚠️ [Performance] Insight generation exceeded 2s budget! (${elapsedTime}ms)`);
        // TODO: Send performance metric to analytics
      }

      // Track analytics
      allInsights.forEach(insight => {
        // analyticsEvents.insightGenerated(insight.insightType);
        console.log(`[Insights] Generated: ${insight.insightType} - ${insight.title}`);
      });

      // FALLBACK: If no insights generated, create encouragement insight
      if (allInsights.length === 0) {
        console.log('[Insights] No insights generated - creating fallback');
        const fallbackInsight = await this.createFallbackInsight(outcome);
        allInsights.push(fallbackInsight);
      }

      return allInsights;
    } catch (error) {
      console.error('[Insights] CRITICAL: Orchestrator failed:', error);

      // EMERGENCY FALLBACK: NEVER let the reward loop fail
      try {
        const emergencyInsight = await this.createFallbackInsight(outcome);
        return [emergencyInsight];
      } catch (fallbackError) {
        console.error('[Insights] CRITICAL: Even fallback failed!', fallbackError);
        // Return empty array as last resort (UI will handle gracefully)
        return [];
      }
    }
  }

  /**
   * Create fallback insight (cold start / error recovery)
   *
   * This ensures the Insight-Driven Loop ALWAYS provides a reward,
   * even on first outcome log or if insight engines fail.
   *
   * Fallback insights are:
   * - Achievement-based (gamification)
   * - Encouraging (positive reinforcement)
   * - Actionable (guide user to log more)
   */
  private async createFallbackInsight(outcome: Outcome): Promise<Insight> {
    const decision = await outcome.decision.fetch();
    const totalOutcomes = await this.countTotalOutcomes();

    // Different fallback messages based on user progress
    let title: string;
    let description: string;

    if (totalOutcomes === 1) {
      title = 'Great start! 🎉';
      description = `You logged your first outcome for "${decision.title}". Keep logging outcomes to unlock personalized insights about your decision patterns.`;
    } else if (totalOutcomes < 5) {
      title = `${totalOutcomes} outcomes logged!`;
      description = `You're building your decision history. Log ${5 - totalOutcomes} more outcomes to unlock correlation insights.`;
    } else if (totalOutcomes === 5) {
      title = 'Milestone reached! 🏆';
      description = `You've logged 5 outcomes! You'll now start receiving powerful insights about hidden patterns in your decisions.`;
    } else {
      title = `${totalOutcomes} decisions analyzed`;
      description = `You're building a strong decision track record. The more you log, the better your insights become.`;
    }

    return await this.database.write(async () => {
      return await this.database.collections.get<Insight>('insights').create(i => {
        i.insightType = 'achievement';
        i.category = 'general';
        i.title = title;
        i.description = description;
        i.dataPayload = JSON.stringify({
          totalOutcomes,
          trigger: 'fallback',
        });
        i.isRead = false;
        i.isArchived = false;
        i.priority = 5; // Medium priority for fallback insights
        i.generatedAt = new Date();
        i.relatedDecisionIds = JSON.stringify([decision.id]);
      });
    });
  }

  /**
   * Count total outcomes logged by user (for achievement tracking)
   */
  private async countTotalOutcomes(): Promise<number> {
    const outcomes = await this.database.collections.get<Outcome>('outcomes').query().fetchCount();
    return outcomes;
  }

  /**
   * Get unread insights (for UI badge)
   */
  async getUnreadInsights(): Promise<Insight[]> {
    return await this.database.collections
      .get<Insight>('insights')
      .query(
        Q.where('is_read', false),
        Q.where('is_archived', false),
        Q.sortBy('priority', Q.desc),
        Q.sortBy('generated_at', Q.desc)
      )
      .fetch();
  }

  /**
   * Mark insight as read (user viewed it)
   */
  async markInsightAsRead(insightId: string): Promise<void> {
    const insight = await this.database.collections.get<Insight>('insights').find(insightId);

    await this.database.write(async () => {
      await insight.update(i => {
        i.isRead = true;
      });
    });

    // analyticsEvents.insightViewed(insight.insightType);
    console.log(`[Insights] Marked as read: ${insight.title}`);
  }

  /**
   * Archive insight (hide from feed)
   */
  async archiveInsight(insightId: string): Promise<void> {
    const insight = await this.database.collections.get<Insight>('insights').find(insightId);

    await this.database.write(async () => {
      await insight.update(i => {
        i.isArchived = true;
      });
    });

    console.log(`[Insights] Archived: ${insight.title}`);
  }

  /**
   * Get all insights for a specific decision
   */
  async getInsightsForDecision(decisionId: string): Promise<Insight[]> {
    const allInsights = await this.database.collections
      .get<Insight>('insights')
      .query(Q.where('is_archived', false), Q.sortBy('generated_at', Q.desc))
      .fetch();

    // Filter by related_decision_ids (stored as JSON array)
    return allInsights.filter(insight => {
      try {
        const relatedIds = JSON.parse(insight.relatedDecisionIds || '[]');
        return relatedIds.includes(decisionId);
      } catch {
        return false;
      }
    });
  }
}
