/**
 * Tab Navigator
 *
 * Bottom tab navigation with Home, Insights, and Profile tabs
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from './types';
import { Colors } from '../theme';

// Import stack navigators
import { HomeStack } from './HomeStack';
import { InsightsStack } from './InsightsStack';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function TabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} />,
        }}
      />
      <Tab.Screen
        name="InsightsTab"
        component={InsightsStack}
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <TabIcon icon="💡" color={color} />,
          // TODO: Add badge for unread insights count
          // tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Tab Icon Component (using emoji for now, can replace with icon library later)
 */
function TabIcon({ icon, color }: { icon: string; color: string }): React.JSX.Element {
  return (
    <Text style={{ fontSize: 24, color }}>
      {icon}
    </Text>
  );
}

import { Text } from 'react-native';
