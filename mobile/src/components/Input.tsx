/**
 * Input Component
 *
 * Reusable input with variants: text, number, slider
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

type InputVariant = 'text' | 'number' | 'slider';

interface BaseInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  style?: ViewStyle;
}

interface TextInputComponentProps extends BaseInputProps {
  variant: 'text';
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
}

interface NumberInputComponentProps extends BaseInputProps {
  variant: 'number';
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}

interface SliderInputComponentProps extends BaseInputProps {
  variant: 'slider';
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
}

type InputProps =
  | TextInputComponentProps
  | NumberInputComponentProps
  | SliderInputComponentProps;

export function Input(props: InputProps): React.JSX.Element {
  const { label, error, required, style } = props;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      {props.variant === 'text' && (
        <TextInput
          style={[
            styles.textInput,
            props.multiline && styles.textInputMultiline,
            error && styles.inputError,
          ]}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={Colors.textLight}
          multiline={props.multiline}
          numberOfLines={props.numberOfLines}
          maxLength={props.maxLength}
          autoCapitalize={props.autoCapitalize}
          autoCorrect={props.autoCorrect}
        />
      )}

      {props.variant === 'number' && (
        <TextInput
          style={[styles.textInput, error && styles.inputError]}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={Colors.textLight}
          keyboardType="numeric"
        />
      )}

      {props.variant === 'slider' && (
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            value={props.value}
            onValueChange={props.onValueChange}
            minimumValue={props.minimumValue}
            maximumValue={props.maximumValue}
            step={props.step ?? 1}
            minimumTrackTintColor={
              props.minimumTrackTintColor ?? Colors.primary
            }
            maximumTrackTintColor={
              props.maximumTrackTintColor ?? Colors.border
            }
            thumbTintColor={Colors.primary}
          />
          {props.showValue !== false && (
            <View style={styles.sliderValueContainer}>
              <Text style={styles.sliderMinMax}>
                {props.formatValue
                  ? props.formatValue(props.minimumValue)
                  : props.minimumValue}
              </Text>
              <Text style={styles.sliderValue}>
                {props.formatValue
                  ? props.formatValue(props.value)
                  : props.value}
              </Text>
              <Text style={styles.sliderMinMax}>
                {props.formatValue
                  ? props.formatValue(props.maximumValue)
                  : props.maximumValue}
              </Text>
            </View>
          )}
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.error,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  textInputMultiline: {
    minHeight: 100,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  sliderContainer: {
    paddingVertical: Spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  sliderValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  sliderMinMax: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textLight,
  },
});
