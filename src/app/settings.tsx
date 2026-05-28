import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Dimensions, Linking } from 'react-native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSettingsHabits, toggleHabitArchiveStatus, createHabit, updateHabit, deleteHabit, updateHabitOrder, Habit, HabitType, exportData, importData } from '@/database';
import { Themes, ThemeId } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSound } from '@/hooks/useSound';
import { getReminderSettings, scheduleDailyReminder, cancelReminder } from '@/hooks/useNotifications';
import { Trash2, Edit2, X, Check, GripVertical, ArrowLeft, Eye, EyeOff, Bell, Download, Upload } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SettingsScreen() {
  const { themeId, setThemeId, colors } = useTheme();
  const { playSound, soundsEnabled, setSoundsEnabled } = useSound();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('checkbox');
  const [configStr, setConfigStr] = useState('');

  // Structured config state
  const [sliderMin, setSliderMin] = useState('1');
  const [sliderMax, setSliderMax] = useState('10');
  const [numberUnit, setNumberUnit] = useState('');

  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalDirection, setGoalDirection] = useState<'on' | 'off' | 'above' | 'below'>('above');
  const [goalTarget, setGoalTarget] = useState('');

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('21:00');
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);

  // Slide-from-top animation
  const translateY = useSharedValue(-SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 22, stiffness: 100, mass: 1 });
    backdropOpacity.value = withTiming(0.55, { duration: 350 });
  }, []);

  const goBack = useCallback(() => {
    router.back();
  }, []);

  const handleBack = useCallback(() => {
    playSound('settings');
    backdropOpacity.value = withTiming(0, { duration: 250 });
    translateY.value = withTiming(-SCREEN_HEIGHT, {
      duration: 300,
      easing: Easing.in(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(goBack)();
    });
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    flex: 1,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const fetchHabits = useCallback(async () => {
    const data = await getSettingsHabits();
    setHabits(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHabits();
      // Load reminder settings
      getReminderSettings().then(({ enabled, time }) => {
        setReminderEnabled(enabled);
        setReminderTime(time);
      });
    }, [fetchHabits])
  );

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setType('checkbox');
    setConfigStr('');
    setSliderMin('1');
    setSliderMax('10');
    setNumberUnit('');
    setGoalEnabled(false);
    setGoalDirection('above');
    setGoalTarget('');
  };

  const handleStartEdit = (h: Habit) => {
    playSound('settings');
    setEditingId(h.id);
    setName(h.name);
    setType(h.type);
    setConfigStr(h.config || '');

    let pMin = '1', pMax = '10', pUnit = '', pGE = false, pGD: any = 'above', pGT = '';
    if (h.config) {
      try {
        const c = JSON.parse(h.config);
        if (c.min !== undefined) pMin = c.min.toString();
        if (c.max !== undefined) pMax = c.max.toString();
        if (c.unit !== undefined) pUnit = c.unit;
        if (c.goal) {
          pGE = !!c.goal.enabled;
          if (c.goal.direction) pGD = c.goal.direction;
          if (c.goal.target !== undefined) pGT = c.goal.target.toString();
        }
      } catch (e) {}
    }
    setSliderMin(pMin);
    setSliderMax(pMax);
    setNumberUnit(pUnit);
    setGoalEnabled(pGE);
    setGoalDirection(pGD);
    setGoalTarget(pGT);
  };

  const handleSave = async () => {
    playSound('settings');
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    const confObj: any = {};
    if (type === 'slider') {
      confObj.min = parseInt(sliderMin) || 0;
      confObj.max = parseInt(sliderMax) || 10;
    }
    if (type === 'number' && numberUnit.trim()) {
      confObj.unit = numberUnit.trim();
    }
    if (goalEnabled) {
      confObj.goal = {
        enabled: true,
        direction: type === 'checkbox' ? (goalDirection === 'off' ? 'off' : 'on') : goalDirection,
      };
      if (type !== 'checkbox') {
        confObj.goal.target = goalTarget;
      }
    }
    const finalConfig = Object.keys(confObj).length > 0 ? JSON.stringify(confObj) : null;

    if (editingId) {
      await updateHabit(editingId, name, type, finalConfig);
    } else {
      await createHabit(name, type, finalConfig, habits.length);
    }

    resetForm();
    fetchHabits();
  };

  const handleDelete = (h: Habit) => {
    playSound('settings');
    Alert.alert('Archive Habit', `Are you sure you want to delete "${h.name}"? Past days will keep their data.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteHabit(h.id);
          fetchHabits();
        }
      }
    ]);
  };

  const handleToggleVisibility = async (h: Habit) => {
    playSound('settings');
    const newStatus = h.is_archived === 1 ? 0 : 1;
    await toggleHabitArchiveStatus(h.id, newStatus);
    fetchHabits();
  };

  const renderHabitItem = ({ item, drag, isActive }: RenderItemParams<Habit>) => (
    <ScaleDecorator>
      <View style={[styles.habitCard, isActive && styles.habitCardActive]}>
        <View style={styles.dragHandle}>
          <Pressable onLongPress={drag} delayLongPress={50}>
            <GripVertical color={colors.overlay0} size={24} />
          </Pressable>
        </View>
        <View style={[styles.habitInfo, { marginLeft: 12 }]}>
          <Text style={styles.habitName}>{item.name}</Text>
          <Text style={styles.habitType}>{item.type.toUpperCase()}</Text>
        </View>
        <View style={styles.actions}>
          {(item.type === 'photo' || item.type === 'notes') ? (
            <Pressable onPress={() => handleToggleVisibility(item)} style={styles.iconBtn}>
              {item.is_archived === 1 ? (
                <EyeOff color={colors.textSecondary} size={20} />
              ) : (
                <Eye color={colors.textSecondary} size={20} />
              )}
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => handleStartEdit(item)} style={styles.iconBtn}>
                <Edit2 color={colors.textSecondary} size={20} />
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} style={styles.iconBtn}>
                <Trash2 color={colors.red} size={20} />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </ScaleDecorator>
  );

  const onDragEnd = async ({ data }: { data: Habit[] }) => {
    setHabits(data);
    const newOrderIds = data.map(h => h.id);
    await updateHabitOrder(newOrderIds);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Dark backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="box-none">
        <Pressable style={{ flex: 1 }} onPress={handleBack} />
      </Animated.View>

      {/* Sliding content */}
      <Animated.View style={[{ backgroundColor: colors.background }, contentStyle]}>
        {/* Custom header with back button */}
        <View style={styles.settingsHeader}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          >
            <ArrowLeft color={colors.text} size={22} />
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </Pressable>
          <Text style={[styles.settingsTitle, { color: colors.text }]}>Settings</Text>
          <Pressable
            onPress={() => Linking.openURL('https://buymeacoffee.com/decentblup')}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, width: 70, alignItems: 'flex-end', justifyContent: 'center' }]}
          >
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Donate</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <DraggableFlatList
            data={habits}
            onDragEnd={onDragEnd}
            keyExtractor={item => item.id.toString()}
            renderItem={renderHabitItem}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <>
                <View style={[styles.formContainer, { backgroundColor: colors.backgroundElement, borderColor: colors.border, zIndex: 1000 }]}>
                  <Text style={[styles.formTitle, { color: colors.text }]}>Appearance</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
                    <Text style={{ color: colors.text, fontSize: 16 }}>UI Sounds</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: colors.surface0, borderRadius: 8, padding: 3 }}>
                       <Pressable style={[soundsEnabled ? { backgroundColor: colors.surface2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 } : {}, { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6, marginRight: 4 }]} onPress={() => { playSound('settings'); setSoundsEnabled(true); }}>
                           <Text style={{ color: soundsEnabled ? colors.text : colors.textSecondary, fontSize: 13, fontWeight: '700' }}>ON</Text>
                       </Pressable>
                       <Pressable style={[!soundsEnabled ? { backgroundColor: colors.surface2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 } : {}, { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 }]} onPress={() => { playSound('settings'); setSoundsEnabled(false); }}>
                           <Text style={{ color: !soundsEnabled ? colors.text : colors.textSecondary, fontSize: 13, fontWeight: '700' }}>OFF</Text>
                       </Pressable>
                    </View>
                  </View>

                  <View style={{ zIndex: 1000 }}>
                    <Pressable
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface1, marginBottom: 0 }]}
                      onPress={() => { playSound('settings'); setIsThemeDropdownOpen(!isThemeDropdownOpen); }}
                    >
                      <Text style={{ color: colors.text, fontSize: 16 }}>
                        {Themes[themeId]?.name || 'Select Theme'}
                      </Text>
                      <Text style={{ color: colors.textSecondary }}>{isThemeDropdownOpen ? '▲' : '▼'}</Text>
                    </Pressable>

                    {isThemeDropdownOpen && (
                      <View style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: colors.surface1,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        marginTop: 4,
                        overflow: 'hidden',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 5,
                        elevation: 5,
                        zIndex: 1001,
                      }}>
                        {(Object.keys(Themes) as ThemeId[]).map((tid) => (
                          <Pressable
                            key={tid}
                            style={({ pressed }) => [
                              { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.surface0 },
                              pressed && { backgroundColor: colors.surface2 },
                              themeId === tid && { backgroundColor: colors.surface0 }
                            ]}
                            onPress={() => {
                              playSound('settings');
                              setThemeId(tid);
                              setIsThemeDropdownOpen(false);
                            }}
                          >
                            <Text style={[{ color: colors.textSecondary }, themeId === tid && { color: colors.primary, fontWeight: 'bold' }]}>
                              {Themes[tid].name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                <View style={[styles.formContainer, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Bell color={colors.primary} size={20} />
                    <Text style={[styles.formTitle, { color: colors.text, marginBottom: 0 }]}>Notifications</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: reminderEnabled ? 12 : 0 }}>
                    <Text style={{ color: colors.text, fontSize: 16 }}>Daily Reminder</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: colors.surface0, borderRadius: 8, padding: 3 }}>
                       <Pressable style={[reminderEnabled ? { backgroundColor: colors.surface2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 } : {}, { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6, marginRight: 4 }]} onPress={async () => {
                         playSound('settings');
                         const [h, m] = reminderTime.split(':').map(Number);
                         const success = await scheduleDailyReminder(h, m);
                         if (success) {
                           setReminderEnabled(true);
                         } else {
                           Alert.alert('Permission Required', 'Please enable notification permissions in your device settings to use reminders.');
                         }
                       }}>
                           <Text style={{ color: reminderEnabled ? colors.text : colors.textSecondary, fontSize: 13, fontWeight: '700' }}>ON</Text>
                       </Pressable>
                       <Pressable style={[!reminderEnabled ? { backgroundColor: colors.surface2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 } : {}, { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 }]} onPress={async () => {
                         playSound('settings');
                         await cancelReminder();
                         setReminderEnabled(false);
                       }}>
                           <Text style={{ color: !reminderEnabled ? colors.text : colors.textSecondary, fontSize: 13, fontWeight: '700' }}>OFF</Text>
                       </Pressable>
                    </View>
                  </View>

                  {reminderEnabled && (
                    <Pressable
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface1, marginBottom: 0 }]}
                      onPress={() => { playSound('settings'); setShowReminderTimePicker(true); }}
                    >
                      <Text style={{ color: colors.text, fontSize: 16 }}>Remind at</Text>
                      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>{reminderTime}</Text>
                    </Pressable>
                  )}

                  {showReminderTimePicker && (
                    <DateTimePicker
                      value={(() => {
                        const [h, m] = reminderTime.split(':').map(Number);
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
                        return d;
                      })()}
                      mode="time"
                      display="default"
                      themeVariant="dark"
                      onValueChange={async (_event: any, selectedDate: Date | undefined) => {
                        setShowReminderTimePicker(false);
                        if (selectedDate) {
                          const h = selectedDate.getHours();
                          const m = selectedDate.getMinutes();
                          const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                          setReminderTime(timeStr);
                          if (reminderEnabled) {
                            await scheduleDailyReminder(h, m);
                          }
                        }
                      }}
                    />
                  )}
                </View>

                <View style={[styles.formContainer, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                  <Text style={[styles.formTitle, { color: colors.text }]}>Data Management</Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable
                      style={[styles.saveBtn, { flex: 1, justifyContent: 'center', backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.border }]}
                      onPress={async () => {
                        playSound('settings');
                        const success = await importData();
                        if (success) {
                          Alert.alert('Success', 'Data imported successfully!');
                          fetchHabits();
                        } else {
                          Alert.alert('Error', 'Failed to import data or invalid file.');
                        }
                      }}
                    >
                      <Download color={colors.text} size={20} />
                      <Text style={[styles.btnText, { color: colors.text }]}>Import Data</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.saveBtn, { flex: 1, justifyContent: 'center' }]}
                      onPress={async () => {
                        playSound('settings');
                        const success = await exportData();
                        if (success) {
                           Alert.alert('Success', 'Data exported successfully!');
                        } else {
                           Alert.alert('Error', 'Failed to export data.');
                        }
                      }}
                    >
                      <Upload color={colors.base} size={20} />
                      <Text style={styles.saveBtnText}>Export Data</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.formContainer}>
                  <Text style={styles.formTitle}>{editingId ? 'Edit Habit' : 'Create New Habit'}</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Habit Name"
                    placeholderTextColor={colors.textSecondary}
                    value={name}
                    onChangeText={setName}
                  />

                  <View style={styles.typeSelector}>
                    {(['checkbox', 'number', 'slider', 'time'] as HabitType[]).map((t) => (
                      <Pressable
                        key={t}
                        style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                        onPress={() => { playSound('settings'); setType(t); }}
                      >
                        <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                          {t}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {type === 'slider' && (
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Min Value"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={sliderMin}
                        onChangeText={setSliderMin}
                      />
                      <View style={{ width: 12 }} />
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Max Value"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={sliderMax}
                        onChangeText={setSliderMax}
                      />
                    </View>
                  )}

                  {type === 'number' && (
                    <TextInput
                      style={styles.input}
                      placeholder="Unit (Optional, e.g. 'glasses')"
                      placeholderTextColor={colors.textSecondary}
                      value={numberUnit}
                      onChangeText={setNumberUnit}
                    />
                  )}

                  <View style={styles.goalSection}>
                    <Pressable
                      style={styles.goalToggleRow}
                      onPress={() => { playSound('settings'); setGoalEnabled(!goalEnabled); }}
                    >
                      <View style={styles.checkbox}>
                        {goalEnabled && <Check color={colors.base} size={14} />}
                      </View>
                      <Text style={styles.goalToggleText}>Specify a Goal</Text>
                    </Pressable>

                    {goalEnabled && (
                      <View style={styles.goalConfigFields}>
                        {type === 'checkbox' && (
                          <View>
                            <Text style={styles.goalFieldLabel}>Aiming for:</Text>
                            <View style={styles.typeSelector}>
                              <Pressable
                                style={[styles.typeBtn, goalDirection === 'on' && styles.typeBtnActive]}
                                onPress={() => { playSound('settings'); setGoalDirection('on'); }}
                              >
                                <Text style={[styles.typeText, goalDirection === 'on' && styles.typeTextActive]}>On</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.typeBtn, goalDirection === 'off' && styles.typeBtnActive]}
                                onPress={() => { playSound('settings'); setGoalDirection('off'); }}
                              >
                                <Text style={[styles.typeText, goalDirection === 'off' && styles.typeTextActive]}>Off</Text>
                              </Pressable>
                            </View>
                          </View>
                        )}

                        {(type === 'number' || type === 'slider' || type === 'time') && (
                          <View>
                            <Text style={styles.goalFieldLabel}>Condition:</Text>
                            <View style={styles.typeSelector}>
                              <Pressable
                                style={[styles.typeBtn, goalDirection === 'above' && styles.typeBtnActive]}
                                onPress={() => { playSound('settings'); setGoalDirection('above'); }}
                              >
                                <Text style={[styles.typeText, goalDirection === 'above' && styles.typeTextActive]}>
                                  {type === 'time' ? 'After' : 'Above'}
                                </Text>
                              </Pressable>
                              <Pressable
                                style={[styles.typeBtn, goalDirection === 'below' && styles.typeBtnActive]}
                                onPress={() => { playSound('settings'); setGoalDirection('below'); }}
                              >
                                <Text style={[styles.typeText, goalDirection === 'below' && styles.typeTextActive]}>
                                  {type === 'time' ? 'Before' : 'Below'}
                                </Text>
                              </Pressable>
                            </View>
                            <Text style={[styles.goalFieldLabel, { marginTop: 12 }]}>
                              Target {type === 'time' ? 'Time (HH:MM)' : 'Number'}:
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder={type === 'time' ? '12:00' : 'e.g. 5'}
                              placeholderTextColor={colors.textSecondary}
                              keyboardType={type === 'time' ? 'default' : 'numeric'}
                              value={goalTarget}
                              onChangeText={setGoalTarget}
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={styles.formActions}>
                    {editingId && (
                      <Pressable style={styles.cancelBtn} onPress={() => { playSound('settings'); resetForm(); }}>
                        <X color={colors.text} size={20} />
                        <Text style={styles.btnText}>Cancel</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.saveBtn} onPress={handleSave}>
                      <Check color={colors.base} size={20} />
                      <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Create'}</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            }
          />
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: any, topInset: number = 0) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'black',
    zIndex: -1,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Math.max(topInset + 16, Platform.OS === 'ios' ? 60 : 40),
    paddingBottom: 12,
    backgroundColor: colors.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  listContent: {
    padding: 16,
  },
  formContainer: {
    backgroundColor: colors.backgroundElement,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.surface1,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    backgroundColor: colors.surface1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface2,
  },
  typeText: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  typeTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  btnText: {
    color: colors.text,
    fontWeight: '600',
  },
  saveBtnText: {
    color: colors.base,
    fontWeight: 'bold',
  },
  habitCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface0,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  habitCardActive: {
    backgroundColor: colors.surface1,
    transform: [{ scale: 1.02 }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  dragHandle: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  habitType: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  iconBtn: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  goalSection: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: colors.surface0,
    borderRadius: 8,
    padding: 12,
  },
  goalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalToggleText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  goalConfigFields: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surface2,
  },
  goalFieldLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
});
