/**
 * Database Module Index
 *
 * Centralized exports for database functionality.
 *
 * Usage:
 *   import { useDatabase, Decision, Outcome } from '@database';
 */

// Database Provider
export { DatabaseProvider, useDatabase, useDatabaseStatus } from './DatabaseProvider';

// Database Infrastructure
export {
  initializeDatabase,
  createSQLCipherAdapter,
  closeDatabase,
  deleteDatabase,
  reencryptDatabase,
  getDatabaseStats,
} from './adapters/sqlite-adapter';

// Encryption Management
export {
  getEncryptionKey,
  rotateEncryptionKey,
  deleteEncryptionKey,
  hasEncryptionKey,
  validateEncryptionKey,
  testEncryptionKey,
} from './encryption/key-manager';

// Schema
export { schema } from './schema';

// Models
export {
  Decision,
  Option,
  Factor,
  FactorScore,
  Outcome,
  Insight,
  UserStat,
  models,
} from './models';

// Types
export type { DecisionStatus, DecisionSource } from './models/Decision';
export type { FactorPreference } from './models/Factor';
export type { LogSource } from './models/Outcome';
export type { InsightType, InsightPriority, InsightMetadata } from './models/Insight';
export type { Badge, StreakData, AccuracyData } from './models/UserStat';
