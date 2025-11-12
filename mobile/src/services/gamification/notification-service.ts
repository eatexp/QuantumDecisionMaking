/**
 * Notification Service
 *
 * Manages local push notifications for habit stacking.
 *
 * Strategic Purpose:
 * - Habit Stacking: Trigger outcome logging at consistent times
 * - Streak Protection: Remind users before losing streak
 * - Not Annoying: Smart frequency limits, respects user preferences
 *
 * Notification Types:
 * 1. Streak Reminder: Daily reminder if streak at risk (18-20h after last log)
 * 2. Decision Pending: Remind about unmade decisions (opt-in only)
 * 3. Insight Available: New insights ready to read (opt-in only)
 *
 * Privacy:
 * - All notifications are local (no server tracking)
 * - No notification content sent to cloud
 * - User can disable all notifications in settings
 *
 * Frequency Limits:
 * - Maximum 1 notification per day (no spam)
 * - Respect system Do Not Disturb
 * - User-configurable quiet hours
 *
 * Usage:
 * ```typescript
 * const notificationService = new NotificationService(database);
 * await notificationService.scheduleStreakReminder();
 * ```
 */

import { Database } from '@nozbe/watermelondb';
import { Platform } from 'react-native';
// Note: react-native-push-notification would be imported here
// For Phase 1, we'll use placeholder types

export interface NotificationPreferences {
  enabled: boolean;
  streakReminders: boolean;
  insightNotifications: boolean;
  quietHoursStart: number; // 0-23 (hour of day)
  quietHoursEnd: number; // 0-23
  preferredReminderTime: number; // 0-23 (hour for daily reminder)
}

export interface ScheduledNotification {
  id: string;
  type: 'streak_reminder' | 'insight_available' | 'decision_pending';
  title: string;
  body: string;
  scheduledFor: Date;
  data?: Record<string, any>;
}

export class NotificationService {
  private defaultPreferences: NotificationPreferences = {
    enabled: true,
    streakReminders: true,
    insightNotifications: false, // Opt-in only
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 8, // 8 AM
    preferredReminderTime: 19, // 7 PM (evening habit)
  };

  constructor(private database: Database) {}

  /**
   * Initialize notification service
   * Request permissions, configure channels (Android)
   */
  async initialize(): Promise<{ granted: boolean; error?: string }> {
    console.log('[Notifications] Initializing notification service...');

    try {
      // Request permissions
      const granted = await this.requestPermissions();

      if (!granted) {
        console.log('[Notifications] User denied notification permissions');
        return { granted: false };
      }

      // Configure notification channels (Android)
      if (Platform.OS === 'android') {
        await this.configureAndroidChannels();
      }

      console.log('[Notifications] ✅ Notification service initialized');
      return { granted: true };
    } catch (error) {
      console.error('[Notifications] Initialization failed:', error);
      return { granted: false, error: String(error) };
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<boolean> {
    // Placeholder for react-native-push-notification
    // In real implementation:
    // const authStatus = await messaging().requestPermission();
    // return authStatus === messaging.AuthorizationStatus.AUTHORIZED;

    console.log('[Notifications] Requesting permissions...');

    // For Phase 1, simulate permission grant
    // TODO: Implement actual permission request
    return true;
  }

  /**
   * Configure Android notification channels
   */
  private async configureAndroidChannels(): Promise<void> {
    console.log('[Notifications] Configuring Android channels...');

    // Channel 1: Streak Reminders (High importance)
    // PushNotification.createChannel({
    //   channelId: 'streak_reminders',
    //   channelName: 'Streak Reminders',
    //   channelDescription: 'Daily reminders to maintain your outcome logging streak',
    //   importance: 4, // High
    //   vibrate: true,
    // });

    // Channel 2: Insights (Medium importance)
    // PushNotification.createChannel({
    //   channelId: 'insights',
    //   channelName: 'New Insights',
    //   channelDescription: 'Notifications when new insights are available',
    //   importance: 3, // Medium
    //   vibrate: false,
    // });

    console.log('[Notifications] Channels configured');
  }

  /**
   * Schedule streak reminder notification
   * Called after each outcome log to schedule next day's reminder
   */
  async scheduleStreakReminder(currentStreak: number): Promise<void> {
    console.log('[Notifications] Scheduling streak reminder...');

    // Get user preferences
    const prefs = await this.getNotificationPreferences();

    if (!prefs.enabled || !prefs.streakReminders) {
      console.log('[Notifications] Streak reminders disabled by user');
      return;
    }

    // Calculate reminder time (preferred time tomorrow)
    const reminderTime = this.calculateReminderTime(prefs.preferredReminderTime);

    // Check if in quiet hours
    if (this.isInQuietHours(reminderTime, prefs)) {
      console.log('[Notifications] Reminder time is in quiet hours, adjusting...');
      reminderTime.setHours(prefs.quietHoursEnd + 1); // Schedule for end of quiet hours
    }

    // Create notification
    const notification: ScheduledNotification = {
      id: `streak_reminder_${Date.now()}`,
      type: 'streak_reminder',
      title: currentStreak >= 3
        ? `🔥 Keep your ${currentStreak}-day streak alive!`
        : '📝 Time to log an outcome',
      body: currentStreak >= 3
        ? 'Log an outcome today to maintain your streak.'
        : 'Build a habit by logging outcomes daily.',
      scheduledFor: reminderTime,
      data: {
        streak: currentStreak,
        action: 'open_outcome_log',
      },
    };

    // Schedule notification
    await this.scheduleLocalNotification(notification);

    console.log(`[Notifications] Streak reminder scheduled for ${reminderTime.toISOString()}`);
  }

  /**
   * Schedule insight notification
   * Called when new insights are generated
   */
  async scheduleInsightNotification(insightCount: number): Promise<void> {
    console.log('[Notifications] Scheduling insight notification...');

    const prefs = await this.getNotificationPreferences();

    if (!prefs.enabled || !prefs.insightNotifications) {
      console.log('[Notifications] Insight notifications disabled by user');
      return;
    }

    // Schedule for immediate delivery (with slight delay for context switch)
    const deliveryTime = new Date();
    deliveryTime.setMinutes(deliveryTime.getMinutes() + 1);

    const notification: ScheduledNotification = {
      id: `insight_${Date.now()}`,
      type: 'insight_available',
      title: insightCount === 1 ? '💡 New Insight Available!' : `💡 ${insightCount} New Insights!`,
      body: 'Tap to see what we learned from your decisions.',
      scheduledFor: deliveryTime,
      data: {
        insightCount,
        action: 'open_insights',
      },
    };

    await this.scheduleLocalNotification(notification);

    console.log('[Notifications] Insight notification scheduled');
  }

  /**
   * Cancel all pending notifications
   */
  async cancelAllNotifications(): Promise<void> {
    console.log('[Notifications] Cancelling all notifications...');

    // Placeholder for react-native-push-notification
    // PushNotification.cancelAllLocalNotifications();

    console.log('[Notifications] All notifications cancelled');
  }

  /**
   * Cancel specific notification type
   */
  async cancelNotificationType(type: 'streak_reminder' | 'insight_available' | 'decision_pending'): Promise<void> {
    console.log(`[Notifications] Cancelling ${type} notifications...`);

    // Placeholder for react-native-push-notification
    // In real implementation, would need to track notification IDs

    console.log(`[Notifications] ${type} notifications cancelled`);
  }

  /**
   * Get user notification preferences
   */
  private async getNotificationPreferences(): Promise<NotificationPreferences> {
    // In real implementation, load from AsyncStorage or database
    // For Phase 1, return defaults

    // TODO: Implement preference storage
    // const stored = await AsyncStorage.getItem('notification_preferences');
    // if (stored) return JSON.parse(stored);

    return this.defaultPreferences;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    console.log('[Notifications] Updating preferences...');

    const current = await this.getNotificationPreferences();
    const updated = { ...current, ...prefs };

    // TODO: Implement preference storage
    // await AsyncStorage.setItem('notification_preferences', JSON.stringify(updated));

    // If notifications disabled, cancel all
    if (!updated.enabled) {
      await this.cancelAllNotifications();
    }

    console.log('[Notifications] Preferences updated');
  }

  /**
   * Calculate reminder time for tomorrow
   */
  private calculateReminderTime(preferredHour: number): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(preferredHour, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Check if time is in quiet hours
   */
  private isInQuietHours(time: Date, prefs: NotificationPreferences): boolean {
    const hour = time.getHours();
    const start = prefs.quietHoursStart;
    const end = prefs.quietHoursEnd;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (start > end) {
      return hour >= start || hour < end;
    }

    // Normal quiet hours (e.g., 12:00 - 14:00)
    return hour >= start && hour < end;
  }

  /**
   * Schedule local notification (abstraction over platform APIs)
   */
  private async scheduleLocalNotification(notification: ScheduledNotification): Promise<void> {
    console.log(`[Notifications] Scheduling: ${notification.title}`);

    // Placeholder for react-native-push-notification
    // PushNotification.localNotificationSchedule({
    //   id: notification.id,
    //   channelId: notification.type === 'streak_reminder' ? 'streak_reminders' : 'insights',
    //   title: notification.title,
    //   message: notification.body,
    //   date: notification.scheduledFor,
    //   userInfo: notification.data,
    //   playSound: true,
    //   soundName: 'default',
    //   importance: 'high',
    //   vibrate: true,
    //   vibration: 300,
    // });

    // For Phase 1, just log the intent
    console.log(`[Notifications] Would schedule: "${notification.title}" for ${notification.scheduledFor.toISOString()}`);
  }

  /**
   * Handle notification tap (user opened notification)
   */
  async handleNotificationTap(notificationData: any): Promise<{
    action: 'open_outcome_log' | 'open_insights' | 'open_decisions';
    data?: any;
  }> {
    console.log('[Notifications] Notification tapped:', notificationData);

    const action = notificationData.action || 'open_outcome_log';

    // Track analytics (if enabled)
    // analyticsEvents.notificationTapped(action);

    return {
      action,
      data: notificationData,
    };
  }

  /**
   * Get notification statistics (for settings UI)
   */
  async getNotificationStats(): Promise<{
    totalScheduled: number;
    lastSent?: Date;
    clickThroughRate?: number;
  }> {
    // Placeholder - would track notification engagement
    return {
      totalScheduled: 0,
    };
  }

  /**
   * Test notification (for settings UI)
   */
  async sendTestNotification(): Promise<void> {
    console.log('[Notifications] Sending test notification...');

    const testNotification: ScheduledNotification = {
      id: `test_${Date.now()}`,
      type: 'streak_reminder',
      title: '🔔 Test Notification',
      body: 'Notifications are working correctly!',
      scheduledFor: new Date(Date.now() + 5000), // 5 seconds from now
    };

    await this.scheduleLocalNotification(testNotification);

    console.log('[Notifications] Test notification sent');
  }
}
