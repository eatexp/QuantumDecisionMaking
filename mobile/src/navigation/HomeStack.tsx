/**
 * Home Stack Navigator
 *
 * Navigation stack for the Home tab (Decision list and details)
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { HomeStackParamList } from './types';

// Import screens (we'll create these next)
import { HomeScreen } from '../screens/Home/HomeScreen';
// import { DecisionDetailScreen } from '../screens/Home/DecisionDetailScreen';
// import { AddDecisionScreen } from '../screens/Home/AddDecisionScreen';
// import { EditDecisionScreen } from '../screens/Home/EditDecisionScreen';

const Stack = createStackNavigator<HomeStackParamList>();

export function HomeStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Decisions',
        }}
      />
      {/* TODO: Add remaining screens after implementation
      <Stack.Screen
        name="DecisionDetail"
        component={DecisionDetailScreen}
        options={{
          title: 'Decision Details',
        }}
      />
      <Stack.Screen
        name="AddDecision"
        component={AddDecisionScreen}
        options={{
          title: 'New Decision',
        }}
      />
      <Stack.Screen
        name="EditDecision"
        component={EditDecisionScreen}
        options={{
          title: 'Edit Decision',
        }}
      />
      */}
    </Stack.Navigator>
  );
}
