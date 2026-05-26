import React, { useState } from 'react';
import { View, Text, Switch, TextInput, StyleSheet, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Habit } from '@/database';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSound } from '@/hooks/useSound';

interface Props {
  habit: Habit;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function HabitInput({ habit, value, onChange, disabled = false, onInteractionStart, onInteractionEnd }: Props) {
  const { colors } = useTheme();
  const { playSound } = useSound();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [showTimePicker, setShowTimePicker] = useState(false);

  let unit = '';
  let goalSummary = '';
  let min = 0, max = 10;
  
  if (habit.config) {
    try {
      const c = JSON.parse(habit.config);
      if (c.unit) unit = c.unit;
      if (c.min !== undefined) min = c.min;
      if (c.max !== undefined) max = c.max;
      
      if (c.goal && c.goal.enabled) {
        if (habit.type === 'checkbox') {
           goalSummary = `Goal: ${c.goal.direction === 'on' ? 'On' : 'Off'}`;
        } else if (habit.type === 'number' || habit.type === 'slider') {
           const dir = c.goal.direction === 'above' ? '>' : '<';
           const u = unit ? ` ${unit}` : '';
           goalSummary = `Goal: ${dir} ${c.goal.target}${u}`;
        } else if (habit.type === 'time') {
           const dir = c.goal.direction === 'above' ? 'After' : 'Before';
           goalSummary = `Goal: ${dir} ${c.goal.target}`;
        }
      }
    } catch (e) {}
  }

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <Text style={styles.label}>{habit.name}</Text>
      <View style={styles.inputWrapper}>
        {habit.type === 'checkbox' && (
          <Switch
            value={value === 'true'}
            onValueChange={(v) => onChange(v ? 'true' : 'false')}
            trackColor={{ false: colors.surface2, true: colors.primary }}
            thumbColor={value === 'true' ? colors.text : colors.surface1}
            disabled={disabled}
          />
        )}

        {habit.type === 'number' && (
          <View style={styles.numberInputContainer}>
            <TextInput
              style={[styles.textInput, disabled && styles.textInputDisabled, { flex: 1 }]}
              value={value}
              onChangeText={onChange}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              editable={!disabled}
            />
            {!!unit && <Text style={styles.unitText}>{unit}</Text>}
          </View>
        )}

        {habit.type === 'slider' && (() => {
          const numVal = parseFloat(value) || min;
          return (
            <View 
              style={styles.sliderContainer}
              onTouchStart={onInteractionStart}
              onTouchEnd={onInteractionEnd}
              onTouchCancel={onInteractionEnd}
            >
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={min}
                maximumValue={max}
                step={1}
                value={numVal}
                onValueChange={(v) => {
                  playSound('slider');
                  onChange(v.toString());
                }}
                onSlidingStart={onInteractionStart}
                onSlidingComplete={onInteractionEnd}
                minimumTrackTintColor={disabled ? colors.surface2 : colors.primary}
                maximumTrackTintColor={colors.surface2}
                thumbTintColor={disabled ? colors.overlay0 : colors.text}
                disabled={disabled}
              />
              <Text style={styles.sliderValue}>{numVal}</Text>
            </View>
          );
        })()}

        {habit.type === 'time' && (
          <View>
            <Pressable
              style={[styles.timeBtn, disabled && styles.timeBtnDisabled]}
              onPress={() => { 
                if (!disabled) {
                  playSound('setTime');
                  setShowTimePicker(true); 
                }
              }}
            >
              <Text style={styles.timeText}>{value || 'Select Time'}</Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={value ? new Date(`1970-01-01T${value}:00`) : new Date()}
                mode="time"
                display="default"
                themeVariant="dark"
                onValueChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (selectedDate) {
                    const timeString = selectedDate.toTimeString().substring(0, 5);
                    onChange(timeString);
                  }
                }}
              />
            )}
          </View>
        )}
      </View>
      {!!goalSummary && <Text style={styles.goalHelperText}>{goalSummary}</Text>}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundElement,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerDisabled: {
    opacity: 0.7,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputWrapper: {
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: {
    backgroundColor: colors.surface1,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
  },
  textInputDisabled: {
    color: colors.textSecondary,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderValue: {
    color: colors.textSecondary,
    width: 40,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  timeBtn: {
    backgroundColor: colors.surface1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeBtnDisabled: {
    opacity: 0.6,
  },
  timeText: {
    color: colors.text,
    fontSize: 16,
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unitText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  goalHelperText: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
});
