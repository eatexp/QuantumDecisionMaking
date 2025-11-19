/**
 * Root Navigator
 *
 * Root navigation structure including tabs and modals
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootNavigatorParamList } from './types';

// Import navigators and screens
import { TabNavigator } from './TabNavigator';
import { OutcomeLoggingScreen } from '../screens/OutcomeLogging/OutcomeLoggingScreen';
// import { OnboardingWelcomeScreen } from '../screens/Onboarding/OnboardingWelcomeScreen';
// import { OnboardingInputScreen } from '../screens/Onboarding/OnboardingInputScreen';
// import { OnboardingReviewScreen } from '../screens/Onboarding/OnboardingReviewScreen';
// import { ScoringModalScreen } from '../screens/Scoring/ScoringModalScreen';

const Stack = createStackNavigator<RootNavigatorParamList>();

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        {/* Main Tab Navigator */}
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{
            headerShown: false,
          }}
        />

        {/* Modal Screens */}
        <Stack.Screen
          name="OutcomeLogging"
          component={OutcomeLoggingScreen}
          options={{
            headerShown: true,
            title: 'Log Outcome',
            presentation: 'modal',
          }}
        />

        {/* TODO: Add remaining modal screens after implementation
        <Stack.Screen
          name="OnboardingWelcome"
          component={OnboardingWelcomeScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="OnboardingInput"
          component={OnboardingInputScreen}
          options={{
            headerShown: true,
            title: 'Describe Your Decision',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="OnboardingReview"
          component={OnboardingReviewScreen}
          options={{
            headerShown: true,
            title: 'Review Decision',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="ScoringModal"
          component={ScoringModalScreen}
          options={{
            headerShown: true,
            title: 'Score Option',
            presentation: 'modal',
          }}
        />
        */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
