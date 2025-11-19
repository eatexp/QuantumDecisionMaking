/**
 * Profile Stack Navigator
 *
 * Navigation stack for the Profile tab (User stats and settings)
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { ProfileStackParamList } from './types';

// Import screens (we'll create these next)
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
// import { SettingsScreen } from '../screens/Profile/SettingsScreen';

const Stack = createStackNavigator<ProfileStackParamList>();

export function ProfileStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
      {/* TODO: Add remaining screens after implementation
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      */}
    </Stack.Navigator>
  );
}
