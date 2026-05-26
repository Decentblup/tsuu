import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting, setSetting } from '@/database';

const REMINDER_ENABLED_KEY = 'reminder_enabled';
const REMINDER_TIME_KEY = 'reminder_time';
const NOTIFICATION_ID = 'daily-habit-reminder';

export async function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('habit-reminders', {
      name: 'Habit Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleDailyReminder(hour: number, minute: number) {
  // Cancel any existing reminder first
  await cancelReminder();

  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'Tsuu 🌱',
      body: 'Remember to log your habits for today!',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === 'android' ? 'habit-reminders' : undefined,
    },
  });

  // Persist to DB
  await setSetting(REMINDER_ENABLED_KEY, 'true');
  await setSetting(REMINDER_TIME_KEY, `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);

  return true;
}

export async function cancelReminder() {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  await setSetting(REMINDER_ENABLED_KEY, 'false');
}

export async function getReminderSettings(): Promise<{ enabled: boolean; time: string }> {
  const enabled = await getSetting(REMINDER_ENABLED_KEY, 'false');
  const time = await getSetting(REMINDER_TIME_KEY, '21:00');
  return {
    enabled: enabled === 'true',
    time,
  };
}
