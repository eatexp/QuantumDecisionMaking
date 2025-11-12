/**
 * Gamification Module Index
 *
 * Centralized exports for gamification services.
 *
 * Usage:
 *   import { GamificationService, NotificationService } from '@services/gamification';
 */

export { GamificationService } from './gamification-service';
export { NotificationService } from './notification-service';

export type {
  GamificationStatus,
  Badge,
} from './gamification-service';

export type {
  NotificationPreferences,
  ScheduledNotification,
} from './notification-service';
