/**
 * Services Module Index
 *
 * Centralized exports for all application services.
 *
 * Usage:
 *   import { InsightOrchestrator, MAUTEngine, GamificationService } from '@services';
 */

// Insight Services
export {
  CorrelationDiscoveryEngine,
  BiasDetectionEngine,
  AccuracyTrackingEngine,
  InsightOrchestrator,
} from './insights/insight-orchestrator';

// Note: Individual engines are exported through orchestrator
// If direct access needed:
export { CorrelationDiscoveryEngine } from './insights/correlation-discovery';
export { BiasDetectionEngine } from './insights/bias-detection';
export { AccuracyTrackingEngine } from './insights/accuracy-tracking';

// Decision Engine
export { MAUTEngine } from './decision-engine/maut-engine';

export type {
  MAUTRecommendation,
  UtilityCalculation,
} from './decision-engine/maut-engine';

// Gamification Services
export {
  GamificationService,
  NotificationService,
} from './gamification';

export type {
  GamificationStatus,
  Badge,
  NotificationPreferences,
  ScheduledNotification,
} from './gamification';

// Insight Types
export type {
  BiasDetectionResult,
} from './insights/bias-detection';

export type {
  AccuracyMetrics,
} from './insights/accuracy-tracking';

// LLM Services
export {
  LLMService,
  DecisionParser,
} from './llm';

export type {
  ParsedDecision,
  ParseDecisionResponse,
  LLMError,
  CreateDecisionResult,
} from './llm';
