/**
 * Insights Stack Navigator
 *
 * Navigation stack for the Insights tab (THE MOAT UI)
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { InsightsStackParamList } from './types';

// Import screens (we'll create these next)
import { InsightFeedScreen } from '../screens/Insights/InsightFeedScreen';
// import { InsightDetailScreen } from '../screens/Insights/InsightDetailScreen';

const Stack = createStackNavigator<InsightsStackParamList>();

export function InsightsStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="InsightFeed"
        component={InsightFeedScreen}
        options={{
          title: 'Insights',
        }}
      />
      {/* TODO: Add remaining screens after implementation
      <Stack.Screen
        name="InsightDetail"
        component={InsightDetailScreen}
        options={{
          title: 'Insight Details',
        }}
      />
      */}
    </Stack.Navigator>
  );
}
