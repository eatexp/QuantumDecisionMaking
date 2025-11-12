/**
 * Quantum Decision Lab - Mobile App Entry Point
 *
 * Phase 1 MVP Architecture:
 * - DatabaseProvider: Encrypted SQLCipher database with hardware keychain
 * - Services: Insights, MAUT engine, Gamification, LLM integration
 * - Privacy-First: All data on-device, zero-knowledge cloud architecture
 *
 * TODO (Week 9-10): Implement full UI screens with React Navigation
 */

import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { DatabaseProvider, useDatabase } from './src/database';
import { LLMService, DecisionParser, GamificationService } from './src/services';

/**
 * Main App Component
 */
function App(): React.JSX.Element {
  return (
    <DatabaseProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.container}>
        <AppContent />
      </SafeAreaView>
    </DatabaseProvider>
  );
}

/**
 * App Content (inside DatabaseProvider)
 */
function AppContent(): React.JSX.Element {
  const database = useDatabase();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Initialize services
      const llmService = new LLMService();
      await llmService.initialize();

      const gamificationService = new GamificationService(database);
      const status = await gamificationService.getGamificationStatus();

      // Get database stats
      const decisions = await database.collections.get('decisions').query().fetchCount();
      const outcomes = await database.collections.get('outcomes').query().fetchCount();
      const insights = await database.collections.get('insights').query().fetchCount();

      setStats({
        decisions,
        outcomes,
        insights,
        streak: status.currentStreak,
        longestStreak: status.longestStreak,
        accuracyScore: status.accuracyScore,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const testLLMService = async () => {
    try {
      console.log('Testing LLM service...');
      const llmService = new LLMService();
      const result = await llmService.testConnection();

      console.log('LLM Test Result:', result);
      alert(
        result.success
          ? `✅ LLM Service Working!\nLatency: ${result.latency}ms`
          : `❌ LLM Service Failed:\n${result.error}`
      );
    } catch (error: any) {
      console.error('LLM test failed:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  const createSampleDecision = async () => {
    try {
      console.log('Creating sample decision...');
      const llmService = new LLMService();
      const parser = new DecisionParser(database);

      // Parse a sample decision
      const parsed = await llmService.parseDecision(
        'Should I accept the job offer at Tech Corp or stay at my current company?'
      );

      console.log('Parsed decision:', parsed);

      // Create in database
      const result = await parser.createDecisionFromParsed(parsed.decision);

      console.log('Created decision:', result.decision.id);

      alert(`✅ Decision Created!\n\nTitle: ${result.decision.title}\nOptions: ${result.options.length}\nFactors: ${result.factors.length}`);

      // Reload stats
      await loadStats();
    } catch (error: any) {
      console.error('Failed to create decision:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing encrypted database...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>⚛️ Quantum Decision Lab</Text>
        <Text style={styles.subtitle}>Phase 1 MVP - Backend Demo</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Privacy-First Architecture</Text>
        <InfoCard label="Encryption" value="AES-256 (SQLCipher)" />
        <InfoCard label="Key Storage" value="Hardware Keychain" />
        <InfoCard label="Architecture" value="Zero-Knowledge" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Database Stats</Text>
        <InfoCard label="Decisions" value={stats?.decisions || 0} />
        <InfoCard label="Outcomes Logged" value={stats?.outcomes || 0} />
        <InfoCard label="Insights Generated" value={stats?.insights || 0} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎮 Gamification</Text>
        <InfoCard label="Current Streak" value={`${stats?.streak || 0} days 🔥`} />
        <InfoCard label="Longest Streak" value={`${stats?.longestStreak || 0} days`} />
        <InfoCard label="Accuracy Score" value={`${stats?.accuracyScore || 0}%`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧪 Test Features</Text>
        <ActionButton title="Test LLM Service" onPress={testLLMService} />
        <ActionButton title="Create Sample Decision" onPress={createSampleDecision} />
        <ActionButton title="Reload Stats" onPress={loadStats} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Backend Implementation: 100% Complete ✅</Text>
        <Text style={styles.footerText}>
          {'\n'}Next: UI Screens (Week 9-10)
          {'\n'}• Decision modeling interface
          {'\n'}• Outcome logging screen
          {'\n'}• Insight feed (THE MOAT UI)
          {'\n'}• User profile/stats
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * Info Card Component
 */
function InfoCard({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/**
 * Action Button Component
 */
function ActionButton({ title, onPress }: { title: string; onPress: () => void }): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666666',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 13,
    color: '#2E7D32',
    lineHeight: 20,
  },
});

export default App;
