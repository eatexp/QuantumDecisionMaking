/**
 * Insight Feed Screen
 *
 * THE MOAT UI - Displays personalized insights from the Insight-Driven Loop
 *
 * Features:
 * - List of insights sorted by priority (unread first, then by created date)
 * - Color-coded insight cards by type
 * - Read/unread state with badge
 * - Pull-to-refresh
 * - Empty state with call-to-action
 * - Tap to mark as read
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
import { useDatabase } from '../../database';
import type { Insight } from '../../database/models/Insight';
import { Card, EmptyState, LoadingSpinner, Badge } from '../../components';
import { Colors, Typography, Spacing, InsightColors, InsightIcons } from '../../theme';
import { Q } from '@nozbe/watermelondb';
import { formatDistanceToNow } from 'date-fns';

export function InsightFeedScreen(): React.JSX.Element {
  const database = useDatabase();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const insightsCollection = database.collections.get<Insight>('insights');

      // Sort: unread first, then by created date (newest first)
      const allInsights = await insightsCollection
        .query(Q.sortBy('created_at', Q.desc))
        .fetch();

      // Custom sort: unread first, then by created date
      const sorted = allInsights.sort((a, b) => {
        if (a.isRead === b.isRead) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return a.isRead ? 1 : -1;
      });

      setInsights(sorted);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInsights();
  };

  const handleInsightPress = async (insight: Insight) => {
    if (!insight.isRead) {
      try {
        await database.write(async () => {
          await insight.update(i => {
            i.isRead = true;
            i.readAt = new Date();
          });
        });

        // Update local state
        setInsights(prev =>
          prev.map(i =>
            i.id === insight.id
              ? { ...i, isRead: true, readAt: new Date() }
              : i
          )
        );
      } catch (error) {
        console.error('Failed to mark insight as read:', error);
      }
    }
  };

  const renderInsightCard = ({ item }: { item: Insight }) => {
    const insightColor = InsightColors[item.type] || Colors.primary;
    const insightIcon = InsightIcons[item.type] || '💡';
    const timeAgo = formatDistanceToNow(item.createdAt, { addSuffix: true });

    return (
      <TouchableOpacity
        onPress={() => handleInsightPress(item)}
        activeOpacity={0.7}
      >
        <Card
          style={[
            styles.insightCard,
            !item.isRead && styles.insightCardUnread,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Text style={styles.insightIcon}>{insightIcon}</Text>
            </View>
            <View style={styles.headerContent}>
              <View style={styles.titleRow}>
                <Text style={styles.insightTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {!item.isRead && (
                  <Badge value="NEW" variant="primary" size="small" />
                )}
              </View>
              <Text style={styles.insightTimestamp}>{timeAgo}</Text>
            </View>
          </View>

          <Text style={styles.insightDescription} numberOfLines={3}>
            {item.description}
          </Text>

          {item.data && (
            <View style={styles.dataContainer}>
              <Text style={styles.dataLabel}>Details:</Text>
              <Text style={styles.dataValue} numberOfLines={2}>
                {typeof item.data === 'object'
                  ? JSON.stringify(item.data, null, 2)
                  : String(item.data)}
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            <View style={[styles.typeBadge, { backgroundColor: insightColor }]}>
              <Text style={styles.typeText}>
                {item.type.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={styles.priorityContainer}>
              <Text style={styles.priorityLabel}>Priority:</Text>
              <Badge
                value={item.priority}
                variant={
                  item.priority === 'high'
                    ? 'error'
                    : item.priority === 'medium'
                    ? 'warning'
                    : 'neutral'
                }
                size="small"
              />
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const unreadCount = insights.filter(i => !i.isRead).length;

  if (loading) {
    return <LoadingSpinner message="Loading insights..." fullScreen />;
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>
            {unreadCount} unread insight{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <FlatList
        data={insights}
        renderItem={renderInsightCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          insights.length === 0 ? styles.emptyContainer : styles.listContainer
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
            icon="💡"
            title="No Insights Yet"
            description="Log an outcome to unlock personalized insights about your decision-making patterns."
            actionLabel="Go to Home"
            onAction={() => {
              // Navigate to Home tab
              // This will be handled by navigation
            }}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  unreadBanner: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  unreadText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
    textAlign: 'center',
  },
  listContainer: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
  },
  insightCard: {
    marginBottom: Spacing.base,
  },
  insightCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  insightIcon: {
    fontSize: 24,
  },
  headerContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  insightTitle: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  insightTimestamp: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textLight,
  },
  insightDescription: {
    fontSize: Typography.fontSize.base,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  dataContainer: {
    backgroundColor: Colors.offWhite,
    borderRadius: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  dataLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textLight,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  dataValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.sm,
  },
  typeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
    textTransform: 'capitalize',
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priorityLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textLight,
  },
});
