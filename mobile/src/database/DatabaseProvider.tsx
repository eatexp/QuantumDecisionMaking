/**
 * DatabaseProvider Context
 *
 * Provides WatermelonDB instance to the entire React Native app via Context API.
 *
 * Usage:
 *   // In App.tsx:
 *   <DatabaseProvider>
 *     <YourApp />
 *   </DatabaseProvider>
 *
 *   // In any component:
 *   const database = useDatabase();
 *   const decisions = await database.collections.get('decisions').query().fetch();
 *
 * Features:
 * - Lazy initialization (database created on first render)
 * - Loading state management
 * - Error handling with retry
 * - Automatic encryption key setup
 * - Development mode diagnostics
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import { initializeDatabase, getDatabaseStats } from './adapters/sqlite-adapter';
import { testEncryptionKey } from './encryption/key-manager';

// Context type
interface DatabaseContextType {
  database: Database | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

// Create context
const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// Provider props
interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * DatabaseProvider Component
 *
 * Initializes and provides database to child components
 */
export function DatabaseProvider({ children }: DatabaseProviderProps): JSX.Element {
  const [database, setDatabase] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    initDB();
  }, [retryCount]);

  const initDB = async () => {
    try {
      console.log('[DatabaseProvider] Initializing database...');
      setIsLoading(true);
      setError(null);

      // Test encryption key first (development only)
      if (__DEV__) {
        const keyTest = await testEncryptionKey();
        if (!keyTest.success) {
          throw new Error(`Encryption key test failed: ${keyTest.error}`);
        }
        console.log('[DatabaseProvider] Encryption key test passed ✅');
      }

      // Initialize database
      const db = await initializeDatabase();
      setDatabase(db);

      // Log stats (development only)
      if (__DEV__) {
        const stats = await getDatabaseStats(db);
        console.log('[DatabaseProvider] Database stats:', stats);
      }

      console.log('[DatabaseProvider] ✅ Database ready');
    } catch (err) {
      console.error('[DatabaseProvider] ❌ Initialization failed:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const retry = () => {
    console.log('[DatabaseProvider] Retrying initialization...');
    setRetryCount(prev => prev + 1);
  };

  const contextValue: DatabaseContextType = {
    database,
    isLoading,
    error,
    retry,
  };

  // Show loading screen
  if (isLoading) {
    return <DatabaseLoadingScreen />;
  }

  // Show error screen
  if (error || !database) {
    return <DatabaseErrorScreen error={error} onRetry={retry} />;
  }

  // Provide database to children
  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * useDatabase Hook
 *
 * Access database from any component
 */
export function useDatabase(): Database {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }

  if (!context.database) {
    throw new Error('Database not initialized');
  }

  return context.database;
}

/**
 * useDatabaseStatus Hook
 *
 * Access database loading/error state
 */
export function useDatabaseStatus(): Omit<DatabaseContextType, 'database'> {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error('useDatabaseStatus must be used within DatabaseProvider');
  }

  return {
    isLoading: context.isLoading,
    error: context.error,
    retry: context.retry,
  };
}

// ==================== UI Components ====================

/**
 * Loading Screen
 */
function DatabaseLoadingScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.title}>Initializing Database</Text>
      <Text style={styles.subtitle}>Setting up encrypted storage...</Text>
    </View>
  );
}

/**
 * Error Screen
 */
interface DatabaseErrorScreenProps {
  error: Error | null;
  onRetry: () => void;
}

function DatabaseErrorScreen({ error, onRetry }: DatabaseErrorScreenProps): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.title}>Database Error</Text>
      <Text style={styles.errorText}>
        {error?.message || 'Failed to initialize database'}
      </Text>

      <View style={styles.buttonContainer}>
        <Text style={styles.retryButton} onPress={onRetry}>
          Retry
        </Text>
      </View>

      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Info (DEV only):</Text>
          <Text style={styles.debugText}>{error?.stack}</Text>
        </View>
      )}
    </View>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    marginTop: 16,
  },
  retryButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    overflow: 'hidden',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    maxWidth: '100%',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 10,
    color: '#666666',
    fontFamily: 'Courier',
  },
});
