/**
 * Database Models Index
 *
 * Centralized export of all WatermelonDB models for convenient imports.
 *
 * Usage:
 *   import { Decision, Option, Outcome } from '@models';
 */

export { Decision } from './Decision';
export { Option } from './Option';
export { Factor } from './Factor';
export { FactorScore } from './FactorScore';
export { Outcome } from './Outcome';
export { Insight } from './Insight';
export { UserStat } from './UserStat';

// Export types
export type { DecisionStatus, DecisionSource } from './Decision';
export type { FactorPreference } from './Factor';
export type { LogSource } from './Outcome';
export type { InsightType, InsightPriority, InsightMetadata } from './Insight';
export type { Badge, StreakData, AccuracyData } from './UserStat';

// Model array for database initialization
import { Decision } from './Decision';
import { Option } from './Option';
import { Factor } from './Factor';
import { FactorScore } from './FactorScore';
import { Outcome } from './Outcome';
import { Insight } from './Insight';
import { UserStat } from './UserStat';

export const models = [
  Decision,
  Option,
  Factor,
  FactorScore,
  Outcome,
  Insight,
  UserStat,
];
