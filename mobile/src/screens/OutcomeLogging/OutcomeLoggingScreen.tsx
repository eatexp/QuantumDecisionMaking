/**
 * Outcome Logging Screen
 *
 * THE CRITICAL UX - Enables the Insight-Driven Loop
 *
 * User journey:
 * 1. Select decision (passed via route params)
 * 2. Rate actual satisfaction (0-10)
 * 3. Rate surprise factor (-3 to +3)
 * 4. Add optional notes
 * 5. Submit → Trigger InsightOrchestrator
 * 6. Show loading state ("Analyzing your decision...")
 * 7. Show success state with insight count
 * 8. Navigate to Insights tab
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootNavigatorParamList } from '../../navigation/types';
import { useDatabase } from '../../database';
import type { Decision } from '../../database/models/Decision';
import type { Option } from '../../database/models/Option';
import type { Outcome } from '../../database/models/Outcome';
import type { Insight } from '../../database/models/Insight';
import { Card, Input, Button, LoadingSpinner } from '../../components';
import { Colors, Typography, Spacing } from '../../theme';
import { InsightOrchestrator, GamificationService } from '../../services';

type OutcomeLoggingRouteProp = RouteProp<RootNavigatorParamList, 'OutcomeLogging'>;
type OutcomeLoggingNavigationProp = StackNavigationProp<RootNavigatorParamList, 'OutcomeLogging'>;

type LoadingState = 'idle' | 'loading' | 'success';

export function OutcomeLoggingScreen(): React.JSX.Element {
  const navigation = useNavigation<OutcomeLoggingNavigationProp>();
  const route = useRoute<OutcomeLoggingRouteProp>();
  const database = useDatabase();

  const { decisionId } = route.params;

  const [decision, setDecision] = useState<Decision | null>(null);
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const [satisfaction, setSatisfaction] = useState<number>(5);
  const [surprise, setSurprise] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [insightCount, setInsightCount] = useState<number>(0);
  const [streakIncreased, setStreakIncreased] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadDecision();
  }, [decisionId]);

  const loadDecision = async () => {
    try {
      setInitialLoading(true);
      const decisionsCollection = database.collections.get<Decision>('decisions');
      const loadedDecision = await decisionsCollection.find(decisionId);
      setDecision(loadedDecision);

      // Get selected option
      const optionsCollection = database.collections.get<Option>('options');
      const options = await loadedDecision.options.fetch();
      const selected = options.find(o => o.isSelected);
      setSelectedOption(selected || null);
    } catch (error) {
      console.error('Failed to load decision:', error);
      Alert.alert('Error', 'Failed to load decision');
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!decision || !selectedOption) {
      Alert.alert('Error', 'Decision or selected option not found');
      return;
    }

    try {
      setLoadingState('loading');

      // 1. Create Outcome
      const outcome = await database.write(async () => {
        return await database.collections.get<Outcome>('outcomes').create(o => {
          o.decisionId = decision.id;
          o.selectedOptionId = selectedOption.id;
          o.actualSatisfaction = satisfaction;
          o.surpriseFactor = surprise;
          o.notes = notes;
          o.loggedAt = new Date();
        });
      });

      console.log('✅ Outcome logged:', outcome.id);

      // 2. Run InsightOrchestrator (THE MOAT)
      const orchestrator = new InsightOrchestrator(database);
      const insights = await orchestrator.runAllEngines(outcome.id);

      console.log(`✅ Generated ${insights.length} insights`);
      setInsightCount(insights.length);

      // 3. Update Gamification
      const gamificationService = new GamificationService(database);
      const gamificationResult = await gamificationService.recordOutcomeLog();

      console.log('✅ Gamification updated:', gamificationResult);
      setStreakIncreased(gamificationResult.streakIncreased);

      // 4. Mark decision as archived
      await database.write(async () => {
        await decision.update(d => {
          d.status = 'archived';
        });
      });

      // 5. Show success state
      setLoadingState('success');

      // 6. Navigate to Insights after delay
      setTimeout(() => {
        navigation.navigate('Main', {
          screen: 'InsightsTab',
          params: {
            screen: 'InsightFeed',
          },
        });
      }, 2000);

    } catch (error) {
      console.error('Failed to log outcome:', error);
      Alert.alert('Error', 'Failed to log outcome. Please try again.');
      setLoadingState('idle');
    }
  };

  const formatSurprise = (value: number): string => {
    if (value === 0) return '0 (As expected)';
    if (value > 0) return `+${value} (Better)`;
    return `${value} (Worse)`;
  };

  if (initialLoading) {
    return <LoadingSpinner message="Loading decision..." fullScreen />;
  }

  if (!decision || !selectedOption) {
    return (
      <View style={styles.container}>
        <Text>Decision not found</Text>
      </View>
    );
  }

  // Loading state - Analyzing decision
  if (loadingState === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner message="Analyzing your decision..." />
        <Text style={styles.loadingSubtext}>
          Running insight engines...
        </Text>
      </View>
    );
  }

  // Success state - Insights generated
  if (loadingState === 'success') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Outcome Logged!</Text>
        <Text style={styles.successMessage}>
          Generated {insightCount} new insight{insightCount !== 1 ? 's' : ''}
        </Text>
        {streakIncreased && (
          <Text style={styles.streakMessage}>
            🔥 Streak increased!
          </Text>
        )}
        <Text style={styles.redirectMessage}>
          Taking you to Insights...
        </Text>
      </View>
    );
  }

  // Main form
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Decision Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Decision</Text>
        <Text style={styles.decisionTitle}>{decision.title}</Text>
        <Text style={styles.selectedOption}>
          You chose: <Text style={styles.selectedOptionName}>{selectedOption.name}</Text>
        </Text>
      </Card>

      {/* Satisfaction Rating */}
      <Card style={styles.section}>
        <Input
          variant="slider"
          label="How satisfied are you with the outcome?"
          value={satisfaction}
          onValueChange={setSatisfaction}
          minimumValue={0}
          maximumValue={10}
          step={1}
          showValue
          formatValue={(v) => `${v}/10`}
          required
        />
        <Text style={styles.helperText}>
          0 = Very dissatisfied, 10 = Very satisfied
        </Text>
      </Card>

      {/* Surprise Factor */}
      <Card style={styles.section}>
        <Input
          variant="slider"
          label="Did the outcome surprise you?"
          value={surprise}
          onValueChange={setSurprise}
          minimumValue={-3}
          maximumValue={3}
          step={1}
          showValue
          formatValue={formatSurprise}
          minimumTrackTintColor={
            surprise < 0 ? Colors.warning : surprise > 0 ? Colors.success : Colors.primary
          }
          required
        />
        <Text style={styles.helperText}>
          -3 = Much worse than expected, 0 = As expected, +3 = Much better than expected
        </Text>
      </Card>

      {/* Notes (Optional) */}
      <Card style={styles.section}>
        <Input
          variant="text"
          label="Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="What happened? What did you learn?"
          multiline
          numberOfLines={4}
          maxLength={500}
        />
        <Text style={styles.characterCount}>
          {notes.length}/500 characters
        </Text>
      </Card>

      {/* Submit Button */}
      <Button
        title="Log Outcome & Generate Insights"
        onPress={handleSubmit}
        variant="primary"
        size="large"
        fullWidth
        style={styles.submitButton}
      />

      {/* Cancel Button */}
      <Button
        title="Cancel"
        onPress={() => navigation.goBack()}
        variant="text"
        size="medium"
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textLight,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  decisionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  selectedOption: {
    fontSize: Typography.fontSize.base,
    color: Colors.textLight,
  },
  selectedOptionName: {
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  helperText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textLight,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  characterCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  submitButton: {
    marginBottom: Spacing.md,
  },
  loadingSubtext: {
    fontSize: Typography.fontSize.base,
    color: Colors.textLight,
    marginTop: Spacing.base,
    textAlign: 'center',
  },
  successIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: Typography.fontSize.lg,
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  streakMessage: {
    fontSize: Typography.fontSize.base,
    color: Colors.warning,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  redirectMessage: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.xl,
    textAlign: 'center',
  },
});
