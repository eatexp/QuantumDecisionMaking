/**
 * Gamification Service
 *
 * Manages extrinsic motivation systems: streaks, badges, achievements.
 *
 * Strategic Role:
 * - Provides SHORT-TERM motivation during cold start (first 2 weeks)
 * - Once Insight-Driven Loop proves value, gamification becomes secondary
 * - Habit stacking: "Log outcome → Get insight → Build streak"
 *
 * Gamification Elements:
 * 1. Streaks: Consecutive days of outcome logging (primary engagement driver)
 * 2. Badges: Milestone achievements (social proof, accomplishment)
 * 3. Accuracy Score: Prediction skill rating (0-100)
 * 4. Progress Bars: Visual feedback for next milestone
 *
 * Design Principles:
 * - Not manipulative (no dark patterns)
 * - Supports intrinsic value discovery
 * - Privacy-preserving (all data on-device)
 * - Optional (can be disabled in settings)
 *
 * Usage:
 * ```typescript
 * const gamification = new GamificationService(database);
 * await gamification.recordOutcomeLog(); // Update streaks, check badges
 * const status = await gamification.getGamificationStatus();
 * ```
 */

import { Database } from '@nozbe/watermelondb';
import { UserStat, Outcome, Insight } from '@database';

export interface GamificationStatus {
  currentStreak: number;
  longestStreak: number;
  totalOutcomes: number;
  totalDecisions: number;
  accuracyScore: number; // 0-100
  newBadges: string[]; // Badge IDs just earned
  nextMilestone: {
    type: 'streak' | 'outcome' | 'accuracy';
    current: number;
    target: number;
    label: string;
  };
  motivationalMessage: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'volume' | 'accuracy' | 'engagement';
  earnedAt?: Date;
}

export class GamificationService {
  constructor(private database: Database) {}

  /**
   * Record outcome log event
   * Updates streaks, checks for badge awards
   */
  async recordOutcomeLog(): Promise<{
    streakIncreased: boolean;
    newBadges: Badge[];
    motivationalMessage: string;
  }> {
    console.log('[Gamification] Recording outcome log...');

    const userStat = await UserStat.getOrCreate(this.database);

    // Store previous streak for comparison
    const previousStreak = userStat.currentStreak;

    // Update UserStat (handles streak logic)
    await userStat.recordOutcomeLog();

    // Refresh to get updated values
    const updatedStat = await UserStat.getOrCreate(this.database);
    const streakIncreased = updatedStat.currentStreak > previousStreak;

    // Check for new badges
    const newBadges = await this.checkAndAwardBadges(updatedStat);

    // Generate motivational message
    const motivationalMessage = this.generateMotivationalMessage(
      updatedStat,
      streakIncreased,
      newBadges
    );

    console.log(`[Gamification] Streak: ${updatedStat.currentStreak} days, Badges: ${newBadges.length} new`);

    return {
      streakIncreased,
      newBadges,
      motivationalMessage,
    };
  }

  /**
   * Check for new badge milestones and award them
   */
  private async checkAndAwardBadges(userStat: UserStat): Promise<Badge[]> {
    const newBadges: Badge[] = [];

    // Get milestone badges that should be awarded
    const milestoneBadges = userStat.getMilestoneBadges();

    for (const badgeData of milestoneBadges) {
      // Award badge (returns true if newly awarded)
      const wasAwarded = await userStat.awardBadge(
        badgeData.id,
        badgeData.name,
        badgeData.description,
        badgeData.icon
      );

      if (wasAwarded) {
        newBadges.push({
          id: badgeData.id,
          name: badgeData.name,
          description: badgeData.description,
          icon: badgeData.icon,
          category: this.getBadgeCategory(badgeData.id),
          earnedAt: new Date(),
        });
      }
    }

    return newBadges;
  }

  /**
   * Get category for badge ID
   */
  private getBadgeCategory(badgeId: string): 'streak' | 'volume' | 'accuracy' | 'engagement' {
    if (badgeId.startsWith('streak_')) return 'streak';
    if (badgeId.includes('outcome') || badgeId.includes('decision')) return 'volume';
    if (badgeId.includes('accurate') || badgeId.includes('prediction')) return 'accuracy';
    return 'engagement';
  }

  /**
   * Generate motivational message based on current state
   */
  private generateMotivationalMessage(
    userStat: UserStat,
    streakIncreased: boolean,
    newBadges: Badge[]
  ): string {
    // Badge celebration takes priority
    if (newBadges.length > 0) {
      const badge = newBadges[0];
      return `🏆 Badge Unlocked: ${badge.name}! ${badge.description}`;
    }

    // Streak milestone celebration
    if (streakIncreased) {
      const streak = userStat.currentStreak;

      if (streak === 3) {
        return "🔥 3-day streak! You're building a habit!";
      } else if (streak === 7) {
        return '🔥🔥 Week streak! Your insights are getting more accurate!';
      } else if (streak === 14) {
        return '🔥🔥 Two weeks strong! Keep it going!';
      } else if (streak === 30) {
        return "🔥🔥🔥 30-day streak! You've mastered the habit!";
      } else if (streak > 1) {
        return `🔥 ${streak}-day streak! Come back tomorrow to keep it alive!`;
      } else {
        return "🎉 Great start! Log an outcome tomorrow to start a streak!";
      }
    }

    // Outcome volume milestones
    const totalOutcomes = userStat.totalOutcomesLogged;
    if (totalOutcomes === 5) {
      return "📊 5 outcomes logged! You'll now start receiving correlation insights!";
    } else if (totalOutcomes === 10) {
      return '📊 10 outcomes! Your insight quality is improving!';
    } else if (totalOutcomes === 25) {
      return '📊 25 outcomes! You have enough data for accurate bias detection!';
    }

    // Accuracy milestones
    const accuracy = userStat.accuracyPercentage;
    if (accuracy >= 70 && totalOutcomes >= 5) {
      return "🎯 70%+ accuracy! You're learning to predict your satisfaction!";
    } else if (accuracy >= 90 && totalOutcomes >= 10) {
      return '🎯 90%+ accuracy! You have exceptional self-knowledge!';
    }

    // Default encouragement
    return 'Great job logging this outcome! Keep building your decision track record.';
  }

  /**
   * Get comprehensive gamification status
   */
  async getGamificationStatus(): Promise<GamificationStatus> {
    const userStat = await UserStat.getOrCreate(this.database);
    const stats = userStat.getStatsSummary();

    // Calculate next milestone
    const nextMilestone = this.calculateNextMilestone(userStat);

    // Check for unawarded badges
    const milestoneBadges = userStat.getMilestoneBadges();
    const newBadgeIds = milestoneBadges.map(b => b.id);

    // Generate motivational message
    const motivationalMessage = this.generateStatusMessage(userStat);

    return {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      totalOutcomes: stats.outcomesLogged,
      totalDecisions: stats.decisions,
      accuracyScore: stats.accuracyPercentage,
      newBadges: newBadgeIds,
      nextMilestone,
      motivationalMessage,
    };
  }

  /**
   * Calculate next milestone for progress tracking
   */
  private calculateNextMilestone(userStat: UserStat): {
    type: 'streak' | 'outcome' | 'accuracy';
    current: number;
    target: number;
    label: string;
  } {
    const currentStreak = userStat.currentStreak;
    const totalOutcomes = userStat.totalOutcomesLogged;
    const accuracy = userStat.accuracyPercentage;

    // Priority 1: Streak milestones (most engaging)
    if (currentStreak < 3) {
      return {
        type: 'streak',
        current: currentStreak,
        target: 3,
        label: '3-Day Streak',
      };
    } else if (currentStreak < 7) {
      return {
        type: 'streak',
        current: currentStreak,
        target: 7,
        label: 'Week Streak',
      };
    } else if (currentStreak < 30) {
      return {
        type: 'streak',
        current: currentStreak,
        target: 30,
        label: 'Month Streak',
      };
    }

    // Priority 2: Outcome volume (unlocks insights)
    if (totalOutcomes < 5) {
      return {
        type: 'outcome',
        current: totalOutcomes,
        target: 5,
        label: 'Unlock Correlations',
      };
    } else if (totalOutcomes < 10) {
      return {
        type: 'outcome',
        current: totalOutcomes,
        target: 10,
        label: 'Committed Logger',
      };
    } else if (totalOutcomes < 50) {
      return {
        type: 'outcome',
        current: totalOutcomes,
        target: 50,
        label: 'Outcome Master',
      };
    }

    // Priority 3: Accuracy improvement
    if (accuracy < 70 && totalOutcomes >= 5) {
      return {
        type: 'accuracy',
        current: accuracy,
        target: 70,
        label: 'Accurate Predictor',
      };
    } else if (accuracy < 90 && totalOutcomes >= 10) {
      return {
        type: 'accuracy',
        current: accuracy,
        target: 90,
        label: 'Prediction Master',
      };
    }

    // Default: Next outcome
    return {
      type: 'outcome',
      current: totalOutcomes,
      target: totalOutcomes + 10,
      label: 'Next Milestone',
    };
  }

  /**
   * Generate status message for gamification overview
   */
  private generateStatusMessage(userStat: UserStat): string {
    const streak = userStat.currentStreak;
    const accuracy = userStat.accuracyPercentage;
    const totalOutcomes = userStat.totalOutcomesLogged;

    if (streak >= 30) {
      return "🔥 You're on fire! 30+ day streak!";
    } else if (streak >= 7) {
      return `🔥 ${streak}-day streak! You've built a strong habit!`;
    } else if (streak >= 3) {
      return `🔥 ${streak}-day streak! Keep it going!`;
    } else if (totalOutcomes === 0) {
      return "👋 Welcome! Log your first outcome to get started!";
    } else if (totalOutcomes < 5) {
      return `Log ${5 - totalOutcomes} more outcomes to unlock correlation insights!`;
    } else if (accuracy >= 70) {
      return `🎯 ${accuracy}% accuracy! You're great at predicting satisfaction!`;
    } else {
      return `You've logged ${totalOutcomes} outcomes. Keep going!`;
    }
  }

  /**
   * Get all badges (earned and unearned)
   */
  async getAllBadges(): Promise<{
    earned: Badge[];
    locked: Badge[];
  }> {
    const userStat = await UserStat.getOrCreate(this.database);
    const earnedBadges = userStat.badges;

    // Define all possible badges
    const allBadgeDefinitions = this.getAllBadgeDefinitions();

    const earned: Badge[] = earnedBadges.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      category: this.getBadgeCategory(b.id),
      earnedAt: new Date(b.earned_at),
    }));

    const locked: Badge[] = allBadgeDefinitions
      .filter(def => !earnedBadges.some(e => e.id === def.id))
      .map(def => ({
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
      }));

    return { earned, locked };
  }

  /**
   * Get all badge definitions
   */
  private getAllBadgeDefinitions(): Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'streak' | 'volume' | 'accuracy' | 'engagement';
  }> {
    return [
      // Decision milestones
      { id: 'first_decision', name: 'First Decision', description: 'Created your first decision model', icon: '🎯', category: 'volume' },
      { id: 'decision_maker', name: 'Decision Maker', description: 'Created 10 decision models', icon: '🏆', category: 'volume' },

      // Outcome logging milestones
      { id: 'first_outcome', name: 'First Outcome', description: 'Logged your first outcome', icon: '📝', category: 'volume' },
      { id: 'committed_logger', name: 'Committed Logger', description: 'Logged 10 outcomes', icon: '🔥', category: 'volume' },
      { id: 'outcome_master', name: 'Outcome Master', description: 'Logged 50 outcomes', icon: '🌟', category: 'volume' },

      // Streak milestones
      { id: 'streak_3', name: '3-Day Streak', description: 'Logged outcomes for 3 days in a row', icon: '🔥', category: 'streak' },
      { id: 'streak_7', name: '7-Day Streak', description: 'One week of daily logging!', icon: '🔥🔥', category: 'streak' },
      { id: 'streak_30', name: '30-Day Streak', description: 'A full month of commitment!', icon: '🔥🔥🔥', category: 'streak' },

      // Accuracy milestones
      { id: 'accurate_predictor', name: 'Accurate Predictor', description: '70%+ prediction accuracy', icon: '🎯', category: 'accuracy' },
      { id: 'prediction_master', name: 'Prediction Master', description: '90%+ prediction accuracy', icon: '🎯🌟', category: 'accuracy' },

      // Engagement milestones
      { id: 'insight_seeker', name: 'Insight Seeker', description: 'Read 80%+ of your insights', icon: '🔍', category: 'engagement' },
    ];
  }

  /**
   * Check if user is at risk of losing streak
   * Used for notification timing
   */
  async isStreakAtRisk(): Promise<{
    atRisk: boolean;
    currentStreak: number;
    hoursSinceLastLog: number;
  }> {
    const userStat = await UserStat.getOrCreate(this.database);
    const hoursSinceLastLog = userStat.daysSinceLastActive * 24;

    return {
      atRisk: userStat.isStreakAtRisk,
      currentStreak: userStat.currentStreak,
      hoursSinceLastLog,
    };
  }

  /**
   * Get streak reminder notification data
   */
  async getStreakReminderNotification(): Promise<{
    title: string;
    body: string;
    shouldSend: boolean;
  } | null> {
    const streakStatus = await this.isStreakAtRisk();

    if (!streakStatus.atRisk || streakStatus.currentStreak === 0) {
      return null;
    }

    // Only send if 18-22 hours since last log (evening reminder)
    if (streakStatus.hoursSinceLastLog < 18 || streakStatus.hoursSinceLastLog > 22) {
      return {
        title: '',
        body: '',
        shouldSend: false,
      };
    }

    return {
      title: `🔥 Don't lose your ${streakStatus.currentStreak}-day streak!`,
      body: 'Log an outcome today to keep your streak alive.',
      shouldSend: true,
    };
  }

  /**
   * Reset user stats (for testing/development)
   */
  async resetGamification(): Promise<void> {
    console.log('[Gamification] Resetting all gamification data...');

    const userStat = await UserStat.getOrCreate(this.database);

    await this.database.write(async () => {
      await userStat.update(stat => {
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
      });
    });

    console.log('[Gamification] Reset complete');
  }
}
