/**
 * Navigation Types
 *
 * TypeScript type definitions for React Navigation
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import type { Decision } from '../database/models/Decision';
import type { Insight } from '../database/models/Insight';

/**
 * Root Tab Navigator Params
 */
export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  InsightsTab: NavigatorScreenParams<InsightsStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

/**
 * Home Stack Navigator Params
 */
export type HomeStackParamList = {
  Home: undefined;
  DecisionDetail: {
    decisionId: string;
  };
  AddDecision: undefined;
  EditDecision: {
    decisionId: string;
  };
};

/**
 * Insights Stack Navigator Params
 */
export type InsightsStackParamList = {
  InsightFeed: undefined;
  InsightDetail: {
    insightId: string;
  };
};

/**
 * Profile Stack Navigator Params
 */
export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
};

/**
 * Modal Stack Navigator Params
 */
export type ModalStackParamList = {
  Onboarding: undefined;
  OnboardingWelcome: undefined;
  OnboardingInput: undefined;
  OnboardingReview: {
    decisionId: string;
  };
  OutcomeLogging: {
    decisionId: string;
  };
  ScoringModal: {
    decisionId: string;
    optionId: string;
  };
};

/**
 * Root Navigator Params (includes Tabs + Modals)
 */
export type RootNavigatorParamList = {
  Main: NavigatorScreenParams<RootTabParamList>;
} & ModalStackParamList;

/**
 * Helper type for navigation props
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootNavigatorParamList {}
  }
}
