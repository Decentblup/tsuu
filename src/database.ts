import * as SQLite from 'expo-sqlite';

export type HabitType = 'checkbox' | 'number' | 'slider' | 'time';

export interface DayEntry {
  date: string;
  image_uri: string | null;
}

export interface Habit {
  id: number;
  name: string;
  type: HabitType;
  config: string | null;
  is_archived: number;
  order_index: number;
}

export interface HabitLog {
  id: number;
  date: string;
  habit_id: number;
  value: string;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('habittracker.db');
  return dbInstance;
}

export async function initDatabase() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS days (
      date TEXT PRIMARY KEY,
      image_uri TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT,
      is_archived INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      habit_id INTEGER NOT NULL,
      value TEXT,
      FOREIGN KEY(date) REFERENCES days(date) ON DELETE CASCADE,
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      UNIQUE(date, habit_id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try {
    // Check if columns exist or just try to add them
    await db.execAsync(`ALTER TABLE habits ADD COLUMN is_archived INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    await db.execAsync(`ALTER TABLE habits ADD COLUMN order_index INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    await db.execAsync(`ALTER TABLE days ADD COLUMN notes TEXT;`);
  } catch (e) {}
}

export async function getDay(date: string): Promise<DayEntry & { notes: string | null } | null> {
  if (!date) return null;
  const db = await getDb();
  return await db.getFirstAsync<DayEntry & { notes: string | null }>('SELECT * FROM days WHERE date = ?', [date]);
}

export async function upsertDayEntry(date: string, imageUri: string | null, notes: string | null = null) {
  if (!date) return;
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO days (date, image_uri, notes) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET image_uri = excluded.image_uri, notes = excluded.notes',
    [date, imageUri || null, notes || null]
  );
}

export async function updateDayNotes(date: string, notes: string) {
    if (!date) return;
    const db = await getDb();
    await db.runAsync(
        'INSERT INTO days (date, notes) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET notes = excluded.notes',
        [date, notes]
    );
}

export async function getSetting(key: string, defaultValue: string): Promise<string> {
    const db = await getDb();
    const result = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return result?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string) {
    const db = await getDb();
    await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value]
    );
}

export async function getHabits(includeArchived = false): Promise<Habit[]> {
  const db = await getDb();
  if (includeArchived) {
    return await db.getAllAsync<Habit>('SELECT * FROM habits ORDER BY order_index ASC, id ASC');
  }
  return await db.getAllAsync<Habit>('SELECT * FROM habits WHERE is_archived = 0 ORDER BY order_index ASC, id ASC');
}

export async function createHabit(name: string, type: HabitType, config: string | null = null, orderIndex: number = 0) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO habits (name, type, config, is_archived, order_index) VALUES (?, ?, ?, 0, ?)',
    [name, type, config || null, orderIndex]
  );
}

export async function updateHabit(id: number, name: string, type: HabitType, config: string | null = null) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE habits SET name = ?, type = ?, config = ? WHERE id = ?',
    [name, type, config || null, id]
  );
}

export async function updateHabitOrder(habitIds: number[]) {
  if (habitIds.length === 0) return;
  const db = await getDb();
  
  // Use a transaction to perform all updates efficiently
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < habitIds.length; i++) {
        await db.runAsync(
            'UPDATE habits SET order_index = ? WHERE id = ?',
            [i, habitIds[i]]
        );
    }
  });
}

export async function deleteHabit(habitId: number) {
  const db = await getDb();
  await db.runAsync('UPDATE habits SET is_archived = 1 WHERE id = ?', [habitId]);
}

export async function getHabitLogs(date: string): Promise<HabitLog[]> {
  if (!date) return [];
  const db = await getDb();
  return await db.getAllAsync<HabitLog>('SELECT * FROM habit_logs WHERE date = ?', [date]);
}

export async function upsertHabitLog(date: string, habitId: number, value: string) {
  if (!date || habitId === undefined) return;
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO habit_logs (date, habit_id, value) VALUES (?, ?, ?) ON CONFLICT(date, habit_id) DO UPDATE SET value = excluded.value',
    [date, habitId, value || '']
  );
}

export async function seedHabitsIfEmpty() {
  const habits = await getHabits(true);
  if (habits.length === 0) {
    await createHabit('Morning Run', 'checkbox');
    await createHabit('Water (Glasses)', 'number');
    await createHabit('Rating', 'slider', JSON.stringify({ min: 1, max: 10 }));
    await createHabit('Bed Time', 'time');
  }
}

// --- Statistics queries ---

export interface HabitStreak {
  habit_id: number;
  habit_name: string;
  habit_type: HabitType;
  current_streak: number;
  best_streak: number;
  total_logged: number;
}

export async function getHabitLogsForRange(
  habitId: number,
  startDate: string,
  endDate: string
): Promise<{ date: string; value: string }[]> {
  if (habitId === undefined || !startDate || !endDate) return [];
  const db = await getDb();
  return await db.getAllAsync<{ date: string; value: string }>(
    'SELECT date, value FROM habit_logs WHERE habit_id = ? AND date >= ? AND date <= ? ORDER BY date ASC',
    [habitId, startDate, endDate]
  );
}

export interface DailyCompletionRate {
  date: string;
  completed: number;
  total: number;
  rate: number;
}

export async function getHabitStreaks(): Promise<HabitStreak[]> {
  const db = await getDb();
  const habits = await getHabits(false);

  const results: HabitStreak[] = [];

  for (const habit of habits) {
    const logs = await db.getAllAsync<{ date: string; value: string }>(
      'SELECT date, value FROM habit_logs WHERE habit_id = ? ORDER BY date DESC',
      [habit.id]
    );

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let totalLogged = 0;

    const today = new Date();
    const checkDate = new Date(today);

    // Build a set of dates where the habit was completed
    const completedDates = new Set<string>();
    for (const log of logs) {
      const hasValue = log.value !== '' && log.value !== '0' && log.value !== 'false';
      if (hasValue) {
        completedDates.add(log.date);
        totalLogged++;
      }
    }

    // Calculate current streak (consecutive days from today going back)
    for (let i = 0; i < 365; i++) {
      const tzOffset = checkDate.getTimezoneOffset() * 60000;
      const dateStr = new Date(checkDate.getTime() - tzOffset).toISOString().split('T')[0];
      if (completedDates.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate best streak
    const sortedDates = Array.from(completedDates).sort();
    tempStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
        const curr = new Date(sortedDates[i] + 'T00:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    }

    results.push({
      habit_id: habit.id,
      habit_name: habit.name,
      habit_type: habit.type,
      current_streak: currentStreak,
      best_streak: bestStreak,
      total_logged: totalLogged,
    });
  }

  return results;
}

export async function getWeeklyCompletionRates(): Promise<DailyCompletionRate[]> {
  const db = await getDb();
  const habits = await getHabits(false);
  const totalHabits = habits.length;
  if (totalHabits === 0) return [];

  const results: DailyCompletionRate[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const dateStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];

    const logs = await db.getAllAsync<{ value: string }>(
      'SELECT value FROM habit_logs WHERE date = ? AND habit_id IN (SELECT id FROM habits WHERE is_archived = 0)',
      [dateStr]
    );

    const completed = logs.filter(l => l.value !== '' && l.value !== '0' && l.value !== 'false').length;
    results.push({
      date: dateStr,
      completed,
      total: totalHabits,
      rate: totalHabits > 0 ? Math.round((completed / totalHabits) * 100) : 0,
    });
  }

  return results;
}

export async function getTotalDaysTracked(): Promise<number> {
  const db = await getDb();
  const result = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(DISTINCT date) as count FROM habit_logs WHERE value != '' AND value != '0' AND value != 'false'"
  );
  return result?.count ?? 0;
}
