/**
 * Quantum Decision Lab - Mobile App Entry Point
 *
 * Phase 1 MVP Architecture:
 * - DatabaseProvider: Encrypted SQLCipher database with hardware keychain
 * - Services: Insights, MAUT engine, Gamification, LLM integration
 * - Privacy-First: All data on-device, zero-knowledge cloud architecture
 * - Navigation: Bottom tabs (Home, Insights, Profile) + Modal screens
 *
 * Week 9-10: Full UI implementation with React Navigation
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { DatabaseProvider } from './src/database';
import { RootNavigator } from './src/navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Main App Component
 */
function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <RootNavigator />
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

export default App;
