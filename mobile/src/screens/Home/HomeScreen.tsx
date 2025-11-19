/**
 * Home Screen
 *
 * Displays list of active decisions and allows creating new decisions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { HomeStackParamList } from '../../navigation/types';
import { useDatabase } from '../../database';
import type { Decision } from '../../database/models/Decision';
import { Card, EmptyState, LoadingSpinner, Button, Badge } from '../../components';
import { Colors, Typography, Spacing } from '../../theme';
import { Q } from '@nozbe/watermelondb';
import { format } from 'date-fns';

type HomeScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'Home'>;

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const database = useDatabase();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDecisions();
  }, []);

  const loadDecisions = async () => {
    try {
      setLoading(true);
      const decisionsCollection = database.collections.get<Decision>('decisions');
      const activeDecisions = await decisionsCollection
        .query(Q.where('status', Q.oneOf(['active', 'completed'])))
        .fetch();

      setDecisions(activeDecisions);
    } catch (error) {
      console.error('Failed to load decisions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDecisions();
  };

  const handleAddDecision = () => {
    // TODO: Navigate to AddDecision screen
    console.log('Add decision');
  };

  const handleLogOutcome = (decisionId: string) => {
    // @ts-ignore - Navigate to modal (will fix types later)
    navigation.navigate('OutcomeLogging', { decisionId });
  };

  const renderDecisionCard = ({ item }: { item: Decision }) => {
    const daysAgo = Math.floor(
      (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isCompleted = item.status === 'completed';

    return (
      <Card style={styles.decisionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.decisionTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.source === 'llm_onboarding' && (
              <Badge value="AI" variant="primary" size="small" style={styles.badge} />
            )}
          </View>
          <Badge
            value={item.status}
            variant={isCompleted ? 'success' : 'neutral'}
            size="small"
          />
        </View>

        <Text style={styles.createdDate}>
          Created {daysAgo === 0 ? 'today' : `${daysAgo} days ago`}
        </Text>

        {isCompleted && (
          <Button
            title="Log Outcome"
            onPress={() => handleLogOutcome(item.id)}
            variant="primary"
            size="small"
            fullWidth
            style={styles.logOutcomeButton}
          />
        )}
      </Card>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading decisions..." fullScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={decisions}
        renderItem={renderDecisionCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          decisions.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No Decisions Yet"
            description="Start by creating your first decision to get personalized insights."
            actionLabel="Create Decision"
            onAction={handleAddDecision}
          />
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddDecision}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContainer: {
    padding: Spacing.base,
    paddingBottom: 80, // Space for FAB
  },
  emptyContainer: {
    flex: 1,
  },
  decisionCard: {
    marginBottom: Spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  decisionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    flex: 1,
  },
  badge: {
    marginLeft: Spacing.sm,
  },
  createdDate: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textLight,
    marginBottom: Spacing.md,
  },
  logOutcomeButton: {
    marginTop: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
});
