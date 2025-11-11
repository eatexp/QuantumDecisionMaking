import { Model } from '@nozbe/watermelondb';
import { field, date, json, readonly, writer } from '@nozbe/watermelondb/decorators';

/**
 * UserStat Model
 *
 * Tracks gamification metrics and user engagement statistics.
 * This is a singleton model (only 1 record exists per user).
 *
 * Purpose:
 * - Extrinsic motivation (gamification) during early usage
 * - Once intrinsic value is proven (insights are valuable), gamification becomes secondary
 *
 * Metrics:
 * - Streaks: Consecutive days of outcome logging
 * - Total counts: Decisions made, outcomes logged, insights viewed
 * - Accuracy: How well user predictions match reality
 * - Badges: Achievement milestones
 *
 * Privacy: All stats are on-device only, never synced to cloud
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string; // ISO 8601 date
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_log_date: string | null; // ISO 8601 date
}

export interface AccuracyData {
  total_predictions: number;
  correct_predictions: number; // Within 2 points of actual
  average_error: number; // Mean absolute error
  last_calculated: string; // ISO 8601 date
}

export class UserStat extends Model {
  static table = 'user_stats';

  // ==================== Fields ====================

  // Counts
  @field('total_decisions') totalDecisions!: number;
  @field('total_outcomes_logged') totalOutcomesLogged!: number;
  @field('total_insights_generated') totalInsightsGenerated!: number;
  @field('total_insights_read') totalInsightsRead!: number;

  // Streaks
  @json('streak_data', sanitizeStreakData) streakData!: StreakData;

  // Accuracy
  @json('accuracy_data', sanitizeAccuracyData) accuracyData!: AccuracyData;

  // Badges
  @json('badges', sanitizeBadges) badges!: Badge[];

  // Timestamps
  @date('first_decision_at') firstDecisionAt?: Date;
  @date('first_outcome_at') firstOutcomeAt?: Date;
  @date('last_active_at') lastActiveAt!: Date;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @field('_deleted') _deleted!: boolean;

  // ==================== Readonly Fields ====================

  @readonly @date('created_at') readonly createdAtReadonly!: Date;

  // ==================== Computed Properties ====================

  /**
   * Get current streak (days)
   */
  get currentStreak(): number {
    return this.streakData.current_streak;
  }

  /**
   * Get longest streak (days)
   */
  get longestStreak(): number {
    return this.streakData.longest_streak;
  }

  /**
   * Get accuracy percentage (0-100)
   */
  get accuracyPercentage(): number {
    if (this.accuracyData.total_predictions === 0) return 0;
    return Math.round((this.accuracyData.correct_predictions / this.accuracyData.total_predictions) * 100);
  }

  /**
   * Get insight read percentage (0-100)
   */
  get insightReadPercentage(): number {
    if (this.totalInsightsGenerated === 0) return 0;
    return Math.round((this.totalInsightsRead / this.totalInsightsGenerated) * 100);
  }

  /**
   * Get outcome logging rate (outcomes per decision)
   */
  get outcomeLoggingRate(): number {
    if (this.totalDecisions === 0) return 0;
    return this.totalOutcomesLogged / this.totalDecisions;
  }

  /**
   * Check if user has a streak going
   */
  get hasActiveStreak(): boolean {
    return this.currentStreak > 0;
  }

  /**
   * Get days since last activity
   */
  get daysSinceLastActive(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.lastActiveAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if user is at risk of losing streak
   */
  get isStreakAtRisk(): boolean {
    if (!this.hasActiveStreak) return false;
    return this.daysSinceLastActive >= 1;
  }

  /**
   * Get total badge count
   */
  get badgeCount(): number {
    return this.badges.length;
  }

  // ==================== Business Logic ====================

  /**
   * Record a new decision
   */
  @writer async recordDecision(): Promise<void> {
    await this.update(stat => {
      stat.totalDecisions += 1;
      stat.lastActiveAt = new Date();
      stat.updatedAt = new Date();

      if (!stat.firstDecisionAt) {
        stat.firstDecisionAt = new Date();
      }
    });
  }

  /**
   * Record a new outcome log
   * This is CRITICAL for streak calculation
   */
  @writer async recordOutcomeLog(): Promise<void> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    await this.update(stat => {
      stat.totalOutcomesLogged += 1;
      stat.lastActiveAt = now;
      stat.updatedAt = now;

      if (!stat.firstOutcomeAt) {
        stat.firstOutcomeAt = now;
      }

      // Update streak
      const lastLogDate = stat.streakData.last_log_date;

      if (!lastLogDate) {
        // First log ever
        stat.streakData = {
          current_streak: 1,
          longest_streak: 1,
          last_log_date: todayStr,
        };
      } else {
        const lastDate = new Date(lastLogDate);
        const daysSinceLastLog = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastLog === 0) {
          // Logged multiple times today, no streak change
          // Update last_log_date to ensure we don't break the streak
          stat.streakData.last_log_date = todayStr;
        } else if (daysSinceLastLog === 1) {
          // Consecutive day, increment streak
          stat.streakData.current_streak += 1;
          stat.streakData.last_log_date = todayStr;

          if (stat.streakData.current_streak > stat.streakData.longest_streak) {
            stat.streakData.longest_streak = stat.streakData.current_streak;
          }
        } else {
          // Streak broken, reset to 1
          stat.streakData.current_streak = 1;
          stat.streakData.last_log_date = todayStr;
        }
      }
    });
  }

  /**
   * Record insight generation
   */
  @writer async recordInsightGenerated(count: number = 1): Promise<void> {
    await this.update(stat => {
      stat.totalInsightsGenerated += count;
      stat.updatedAt = new Date();
    });
  }

  /**
   * Record insight read
   */
  @writer async recordInsightRead(): Promise<void> {
    await this.update(stat => {
      stat.totalInsightsRead += 1;
      stat.lastActiveAt = new Date();
      stat.updatedAt = new Date();
    });
  }

  /**
   * Update accuracy data (called by accuracy tracking engine)
   */
  @writer async updateAccuracy(
    totalPredictions: number,
    correctPredictions: number,
    averageError: number
  ): Promise<void> {
    await this.update(stat => {
      stat.accuracyData = {
        total_predictions: totalPredictions,
        correct_predictions: correctPredictions,
        average_error: averageError,
        last_calculated: new Date().toISOString(),
      };
      stat.updatedAt = new Date();
    });
  }

  /**
   * Award a badge
   */
  @writer async awardBadge(badgeId: string, name: string, description: string, icon: string): Promise<boolean> {
    // Check if badge already earned
    const alreadyEarned = this.badges.some(b => b.id === badgeId);
    if (alreadyEarned) {
      return false;
    }

    await this.update(stat => {
      stat.badges = [
        ...stat.badges,
        {
          id: badgeId,
          name,
          description,
          icon,
          earned_at: new Date().toISOString(),
        },
      ];
      stat.updatedAt = new Date();
    });

    return true;
  }

  /**
   * Check if user should receive milestone badges
   * Returns list of badge IDs to award
   */
  getMilestoneBadges(): Array<{ id: string; name: string; description: string; icon: string }> {
    const badges: Array<{ id: string; name: string; description: string; icon: string }> = [];

    // Decision milestones
    if (this.totalDecisions >= 1 && !this.hasBadge('first_decision')) {
      badges.push({
        id: 'first_decision',
        name: 'First Decision',
        description: 'Created your first decision model',
        icon: '🎯',
      });
    }

    if (this.totalDecisions >= 10 && !this.hasBadge('decision_maker')) {
      badges.push({
        id: 'decision_maker',
        name: 'Decision Maker',
        description: 'Created 10 decision models',
        icon: '🏆',
      });
    }

    // Outcome logging milestones
    if (this.totalOutcomesLogged >= 1 && !this.hasBadge('first_outcome')) {
      badges.push({
        id: 'first_outcome',
        name: 'First Outcome',
        description: 'Logged your first outcome',
        icon: '📝',
      });
    }

    if (this.totalOutcomesLogged >= 10 && !this.hasBadge('committed_logger')) {
      badges.push({
        id: 'committed_logger',
        name: 'Committed Logger',
        description: 'Logged 10 outcomes',
        icon: '🔥',
      });
    }

    if (this.totalOutcomesLogged >= 50 && !this.hasBadge('outcome_master')) {
      badges.push({
        id: 'outcome_master',
        name: 'Outcome Master',
        description: 'Logged 50 outcomes',
        icon: '🌟',
      });
    }

    // Streak milestones
    if (this.currentStreak >= 3 && !this.hasBadge('streak_3')) {
      badges.push({
        id: 'streak_3',
        name: '3-Day Streak',
        description: 'Logged outcomes for 3 days in a row',
        icon: '🔥',
      });
    }

    if (this.currentStreak >= 7 && !this.hasBadge('streak_7')) {
      badges.push({
        id: 'streak_7',
        name: '7-Day Streak',
        description: 'One week of daily logging!',
        icon: '🔥🔥',
      });
    }

    if (this.currentStreak >= 30 && !this.hasBadge('streak_30')) {
      badges.push({
        id: 'streak_30',
        name: '30-Day Streak',
        description: 'A full month of commitment!',
        icon: '🔥🔥🔥',
      });
    }

    // Accuracy milestones
    if (this.accuracyPercentage >= 70 && this.accuracyData.total_predictions >= 5 && !this.hasBadge('accurate_predictor')) {
      badges.push({
        id: 'accurate_predictor',
        name: 'Accurate Predictor',
        description: '70%+ prediction accuracy',
        icon: '🎯',
      });
    }

    if (this.accuracyPercentage >= 90 && this.accuracyData.total_predictions >= 10 && !this.hasBadge('prediction_master')) {
      badges.push({
        id: 'prediction_master',
        name: 'Prediction Master',
        description: '90%+ prediction accuracy',
        icon: '🎯🌟',
      });
    }

    // Insight engagement
    if (this.insightReadPercentage >= 80 && this.totalInsightsGenerated >= 5 && !this.hasBadge('insight_seeker')) {
      badges.push({
        id: 'insight_seeker',
        name: 'Insight Seeker',
        description: 'Read 80%+ of your insights',
        icon: '🔍',
      });
    }

    return badges;
  }

  /**
   * Check if user has a specific badge
   */
  hasBadge(badgeId: string): boolean {
    return this.badges.some(b => b.id === badgeId);
  }

  /**
   * Get stats summary for display
   */
  getStatsSummary(): {
    decisions: number;
    outcomesLogged: number;
    currentStreak: number;
    longestStreak: number;
    accuracyPercentage: number;
    badgeCount: number;
    outcomeLoggingRate: string;
  } {
    return {
      decisions: this.totalDecisions,
      outcomesLogged: this.totalOutcomesLogged,
      currentStreak: this.currentStreak,
      longestStreak: this.longestStreak,
      accuracyPercentage: this.accuracyPercentage,
      badgeCount: this.badgeCount,
      outcomeLoggingRate: `${Math.round(this.outcomeLoggingRate * 100)}%`,
    };
  }

  /**
   * Get or create singleton UserStat instance
   */
  static async getOrCreate(database: any): Promise<UserStat> {
    const existing = await database.collections.get<UserStat>('user_stats').query().fetch();

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new UserStat
    return await database.write(async () => {
      return await database.collections.get<UserStat>('user_stats').create((stat: UserStat) => {
        stat.totalDecisions = 0;
        stat.totalOutcomesLogged = 0;
        stat.totalInsightsGenerated = 0;
        stat.totalInsightsRead = 0;
        stat.streakData = {
          current_streak: 0,
          longest_streak: 0,
          last_log_date: null,
        };
        stat.accuracyData = {
          total_predictions: 0,
          correct_predictions: 0,
          average_error: 0,
          last_calculated: new Date().toISOString(),
        };
        stat.badges = [];
        stat.lastActiveAt = new Date();
        stat.createdAt = new Date();
        stat.updatedAt = new Date();
      });
    });
  }
}

/**
 * Sanitize streak data JSON
 */
function sanitizeStreakData(json: any): StreakData {
  if (typeof json === 'object' && json !== null) {
    return {
      current_streak: json.current_streak || 0,
      longest_streak: json.longest_streak || 0,
      last_log_date: json.last_log_date || null,
    };
  }

  return {
    current_streak: 0,
    longest_streak: 0,
    last_log_date: null,
  };
}

/**
 * Sanitize accuracy data JSON
 */
function sanitizeAccuracyData(json: any): AccuracyData {
  if (typeof json === 'object' && json !== null) {
    return {
      total_predictions: json.total_predictions || 0,
      correct_predictions: json.correct_predictions || 0,
      average_error: json.average_error || 0,
      last_calculated: json.last_calculated || new Date().toISOString(),
    };
  }

  return {
    total_predictions: 0,
    correct_predictions: 0,
    average_error: 0,
    last_calculated: new Date().toISOString(),
  };
}

/**
 * Sanitize badges JSON
 */
function sanitizeBadges(json: any): Badge[] {
  if (Array.isArray(json)) {
    return json.map(b => ({
      id: b.id || '',
      name: b.name || '',
      description: b.description || '',
      icon: b.icon || '',
      earned_at: b.earned_at || new Date().toISOString(),
    }));
  }

  return [];
}
