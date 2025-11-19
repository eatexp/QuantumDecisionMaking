/**
 * Profile Screen
 *
 * Displays user stats, badges, and gamification progress
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useDatabase } from '../../database';
import { GamificationService } from '../../services';
import type { GamificationStatus, Badge as BadgeType } from '../../services';
import { Card, LoadingSpinner, Badge } from '../../components';
import { Colors, Typography, Spacing } from '../../theme';

export function ProfileScreen(): React.JSX.Element {
  const database = useDatabase();
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const gamificationService = new GamificationService(database);
      const gamificationStatus = await gamificationService.getGamificationStatus();
      setStatus(gamificationStatus);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  if (loading) {
    return <LoadingSpinner message="Loading profile..." fullScreen />;
  }

  if (!status) {
    return (
      <View style={styles.container}>
        <Text>Failed to load profile</Text>
      </View>
    );
  }

  const earnedBadges = status.badges.filter(b => b.earned);
  const lockedBadges = status.badges.filter(b => !b.earned);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>👤</Text>
        <Text style={styles.headerTitle}>Your Profile</Text>
        <Text style={styles.headerSubtitle}>Anonymous User</Text>
      </View>

      {/* Stats Card */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Your Stats</Text>
        <StatRow label="Current Streak" value={`${status.currentStreak} days`} highlight />
        <StatRow label="Longest Streak" value={`${status.longestStreak} days`} />
        <StatRow label="Total Decisions" value={status.totalDecisions} />
        <StatRow label="Outcomes Logged" value={status.totalOutcomes} />
        <StatRow label="Accuracy Score" value={`${status.accuracyScore}%`} />
        <StatRow label="Total Insights" value={status.totalInsights} />
      </Card>

      {/* Earned Badges */}
      {earnedBadges.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Earned Badges</Text>
          {earnedBadges.map((badge) => (
            <BadgeRow key={badge.id} badge={badge} />
          ))}
        </Card>
      )}

      {/* Locked Badges */}
      {lockedBadges.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🔒 Locked Badges</Text>
          {lockedBadges.map((badge) => (
            <BadgeRow key={badge.id} badge={badge} locked />
          ))}
        </Card>
      )}

      {/* Motivational Message */}
      {status.motivationalMessage && (
        <Card style={styles.messageCard} variant="outlined">
          <Text style={styles.motivationalMessage}>
            💬 {status.motivationalMessage}
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

/**
 * Stat Row Component
 */
function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Badge Row Component
 */
function BadgeRow({
  badge,
  locked = false,
}: {
  badge: BadgeType;
  locked?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.badgeRow, locked && styles.badgeRowLocked]}>
      <Text style={styles.badgeIcon}>{badge.icon}</Text>
      <View style={styles.badgeContent}>
        <Text style={[styles.badgeName, locked && styles.badgeNameLocked]}>
          {badge.name}
        </Text>
        <Text style={styles.badgeDescription}>{badge.description}</Text>
        {badge.earned && badge.earnedAt && (
          <Text style={styles.badgeDate}>
            Earned {new Date(badge.earnedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
      {badge.earned && (
        <Badge value="✓" variant="success" size="small" />
      )}
    </View>
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
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.textLight,
  },
  section: {
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.textLight,
  },
  statValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  statValueHighlight: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  badgeRowLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  badgeContent: {
    flex: 1,
  },
  badgeName: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  badgeNameLocked: {
    color: Colors.textLight,
  },
  badgeDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textLight,
  },
  badgeDate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },
  messageCard: {
    marginBottom: Spacing.base,
    backgroundColor: Colors.primaryLight,
  },
  motivationalMessage: {
    fontSize: Typography.fontSize.base,
    color: Colors.text,
    lineHeight: 24,
  },
});
