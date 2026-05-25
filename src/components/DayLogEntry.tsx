import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, TextInput, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getDay, getHabits, getHabitLogs, upsertDayEntry, upsertHabitLog, Habit, HabitLog } from '@/database';
import { HabitInput } from '@/components/HabitInput';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Camera, Image as ImageIcon, Save, Pencil } from 'lucide-react-native';

function getLocalToday(): string {
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - tzOffset).toISOString().split('T')[0];
}

export function DayLogEntry({ date, onScrollChange }: { date: string, onScrollChange?: (val: boolean) => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const isToday = useMemo(() => date === getLocalToday(), [date]);


  const [loading, setLoading] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [editing, setEditing] = useState(isToday); // today is always editable by default
  const [showPhotoDropdown, setShowPhotoDropdown] = useState(false);

  const fetchData = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    const dayData = await getDay(date);
    if (dayData) {
      if (dayData.image_uri) setImageUri(dayData.image_uri);
      if (dayData.notes) setNotes(dayData.notes);
    }

    const allHabits = await getHabits(true);
    const existingLogs = await getHabitLogs(date);

    const logsMap: Record<number, string> = {};
    existingLogs.forEach(log => {
      logsMap[log.habit_id] = log.value;
    });

    const visibleHabits = allHabits.filter(h => {
      if (h.is_archived === 0) return true;
      if (!isToday && logsMap[h.id] !== undefined) return true;
      return false;
    });
    setHabits(visibleHabits);
    setLogs(logsMap);
    setLoading(false);
  }, [date, isToday]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );



  const handleUpdateLog = async (habitId: number, value: string) => {
    setLogs(prev => ({ ...prev, [habitId]: value }));
    if (editing) {
      await upsertHabitLog(date, habitId, value);
    }
  };

  const handleNotesChange = async (text: string) => {
    setNotes(text);
    if (editing) {
      // Notes already auto-save via upsertDayEntry
      await upsertDayEntry(date, imageUri, text);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const tempUri = result.assets[0].uri;
      const filename = tempUri.split('/').pop();
      const newUri = `${FileSystem.documentDirectory}${date}-${filename}`;
      try {
        await FileSystem.copyAsync({ from: tempUri, to: newUri });
        setImageUri(newUri);
        // Auto-save image too
        if (editing) await upsertDayEntry(date, newUri, notes);
      } catch (e) {
        console.error('Failed to copy image to local storage', e);
        setImageUri(tempUri);
        if (editing) await upsertDayEntry(date, tempUri, notes);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const dateObj = new Date(date + 'T00:00:00');
  const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <KeyboardAwareScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      bounces={true}
      alwaysBounceVertical={true}
      overScrollMode="always"
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={80}
    >
      <View style={styles.cardContainer}>
        {/* Header row with date + edit button */}
        <View style={styles.headerRow}>
          <Text style={styles.headerDate}>{dateStr}</Text>
          <View style={styles.headerRightContents}>
            {!isToday && !editing && (
              <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
                <Pencil color={colors.text} size={14} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            )}
            {!isToday && editing && (
              <Pressable style={styles.doneBtn} onPress={() => setEditing(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            )}
          </View>
        </View>

      {/* Picture Section */}
      <Pressable 
        style={styles.imageSection}
        onPress={() => {
          if (editing) setShowPhotoDropdown(!showPhotoDropdown);
        }}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={[styles.imagePreview, showPhotoDropdown && { opacity: 0.5 }]} />
        ) : (
          <View style={styles.imagePlaceholder}>
            {editing ? (
              <>
                <Camera color={colors.textSecondary} size={32} style={{ marginBottom: 8 }} />
                <Text style={styles.placeholderText}>Tap to add photo</Text>
              </>
            ) : (
              <Text style={styles.placeholderText}>No photo was added for this day</Text>
            )}
          </View>
        )}
        
        {editing && showPhotoDropdown && (
          <View style={styles.photoDropdown}>
            <Pressable style={styles.dropdownBtn} onPress={() => { setShowPhotoDropdown(false); pickImage(true); }}>
              <Camera color={colors.text} size={20} />
              <Text style={styles.btnText}>Camera</Text>
            </Pressable>
            <View style={styles.dropdownDivider} />
            <Pressable style={styles.dropdownBtn} onPress={() => { setShowPhotoDropdown(false); pickImage(false); }}>
              <ImageIcon color={colors.text} size={20} />
              <Text style={styles.btnText}>Gallery</Text>
            </Pressable>
          </View>
        )}
      </Pressable>

      {/* Notes Section */}
      <View style={styles.notesSection}>
         <Text style={styles.sectionTitle}>Notes</Text>
         <TextInput
           style={[styles.notesInput, !editing && styles.notesInputDisabled]}
           placeholder={editing ? "How was your day?" : "No notes for this day"}
           placeholderTextColor={colors.textSecondary}
           value={notes}
           onChangeText={handleNotesChange}
           multiline
           editable={editing}
           textAlignVertical="top"
         />
      </View>

        {/* Habits Section */}
        <View style={styles.habitsSection}>
          <Text style={styles.sectionTitle}>Habits</Text>
          {habits.map(habit => (
            <HabitInput
              key={habit.id}
              habit={habit}
              value={logs[habit.id] || ''}
              onChange={(val) => handleUpdateLog(habit.id, val)}
              disabled={!editing}
              onInteractionStart={() => onScrollChange?.(false)}
              onInteractionEnd={() => onScrollChange?.(true)}
            />
          ))}
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  cardContainer: {
    backgroundColor: colors.surface0,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRightContents: {
    alignItems: 'flex-end',
    gap: 8,
  },
  headerDate: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  editingBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editingBadgeText: {
    color: colors.base,
    fontWeight: 'bold',
    fontSize: 12,
  },
  imageSection: {
    marginBottom: 4,
    backgroundColor: colors.backgroundElement,
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: colors.surface1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  photoDropdown: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -70 }, { translateY: -50 }],
    width: 140,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    borderRadius: 8,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: colors.surface0,
    marginVertical: 4,
  },
  btnText: {
    color: colors.text,
    fontWeight: '600',
  },
  habitsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveBtnSuccess: {
    backgroundColor: colors.surface2,
  },
  saveBtnText: {
    color: colors.base,
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveBtnTextSuccess: {
    color: colors.text,
  },
  notesSection: {
    marginBottom: 4,
    backgroundColor: colors.backgroundElement,
    borderRadius: 12,
    padding: 8,
  },
  notesInput: {
    backgroundColor: colors.surface1,
    color: colors.text,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginTop: 8,
  },
  notesInputDisabled: {
    backgroundColor: 'transparent',
    padding: 0,
    minHeight: 0,
    marginTop: 4,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  doneBtnText: {
    color: colors.base,
    fontWeight: 'bold',
    fontSize: 12,
  },
});
