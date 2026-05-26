import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Dimensions, InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useTabTransition } from '@/hooks/useTabTransition';
import { getHabits, getHabitLogsForRange, Habit, HabitType } from '@/database';
import { useTheme } from '@/hooks/use-theme';
import { useSound } from '@/hooks/useSound';
import { ChevronLeft, ChevronRight, LayoutGrid, LineChart } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'Weekly' | 'Monthly' | 'Yearly';

export default function StatisticsScreen() {
  const { colors } = useTheme();
  const { playSound } = useSound();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const tabAnimStyle = useTabTransition('right');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('Weekly');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<{ date: string; value: string }[]>([]);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [heatmapMode, setHeatmapMode] = useState<'value' | 'goal'>('value');
  const heatmapScrollRef = React.useRef<ScrollView>(null);

  const fetchInitialData = useCallback(async () => {
    const allHabits = await getHabits(false);
    setHabits(allHabits);
    if (allHabits.length > 0 && !selectedHabit) {
      setSelectedHabit(allHabits[0]);
    }
  }, [selectedHabit]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchInitialData();
      });
      return () => task.cancel();
    }, [fetchInitialData])
  );

  useEffect(() => {
    setHeatmapMode('value');
  }, [selectedHabit]);

  const goalConfig = useMemo(() => {
    if (!selectedHabit || !selectedHabit.config) return null;
    try {
      const c = JSON.parse(selectedHabit.config);
      if (c.goal && c.goal.enabled) return c.goal;
    } catch (e) {}
    return null;
  }, [selectedHabit]);

  useEffect(() => {
    if (selectedHabit) {
      const fetchLogs = async () => {
        setLoading(true);
        const start = `${viewYear}-01-01`;
        const end = `${viewYear}-12-31`;
        const data = await getHabitLogsForRange(selectedHabit.id, start, end);
        setLogs(data);
        setLoading(false);
        
        // Auto-scroll to today after layout
        setTimeout(() => {
           if (heatmapScrollRef.current) {
              const weekWidth = 14 + 4; // width + gap
              const today = new Date();
              if (today.getFullYear() === viewYear) {
                const startOfYear = new Date(viewYear, 0, 1);
                const diff = today.getTime() - startOfYear.getTime();
                const dayOfYear = Math.floor(diff / 86400000);
                const currentWeek = Math.floor(dayOfYear / 7);
                const scrollX = Math.max(0, currentWeek * weekWidth - SCREEN_WIDTH / 2 + 50);
                heatmapScrollRef.current.scrollTo({ x: scrollX, animated: true });
              }
           }
        }, 300);
      };
      fetchLogs();
    }
  }, [selectedHabit, viewYear]);

  const habitLogsMap = useMemo(() => {
    const map: Record<string, string> = {};
    logs.forEach(log => {
      map[log.date] = log.value;
    });
    return map;
  }, [logs]);

  const renderHeatmap = () => {
    if (!selectedHabit) return null;

    const weeks = [];
    let currentWeek = [];
    const startDate = new Date(viewYear, 0, 1);
    const endDate = new Date(viewYear, 11, 31);
    
    // Adjust start offset to the beginning of the week
    const firstDayOffset = startDate.getDay();
    for (let i = 0; i < firstDayOffset; i++) {
      currentWeek.push(null);
    }

    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const dateStr = tempDate.toISOString().split('T')[0];
      currentWeek.push(dateStr);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    const isGoalMet = (type: string, val: string, goal: any) => {
      if (type === 'checkbox') {
        const isChecked = val === 'true' || val === '1';
        return goal.direction === 'on' ? isChecked : !isChecked;
      }
      if (type === 'time') {
        const [h, m] = val.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return false;
        const mins = h * 60 + m;
        const [gh, gm] = goal.target.split(':').map(Number);
        const gMins = gh * 60 + gm;
        return goal.direction === 'above' ? mins > gMins : mins < gMins;
      }
      const numericVal = parseFloat(val);
      const targetVal = parseFloat(goal.target);
      if (isNaN(numericVal) || isNaN(targetVal)) return false;
      if (goal.direction === 'above') return numericVal >= targetVal;
      return numericVal <= targetVal;
    };

    const getIntensity = (dateStr: string | null) => {
      if (!dateStr || !habitLogsMap[dateStr]) return 0;
      const val = habitLogsMap[dateStr];
      
      if (heatmapMode === 'goal' && goalConfig) {
        return isGoalMet(selectedHabit.type, val, goalConfig) ? 1 : 0;
      }

      if (selectedHabit.type === 'checkbox') {
        return val === 'true' || val === '1' ? 1 : 0;
      }
      
      if (selectedHabit.type === 'time') {
        const [h, m] = val.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return 0;
        const mins = h * 60 + m;
        return Math.min(mins / 1440, 1);
      }

      const numericVal = parseFloat(val);
      if (isNaN(numericVal)) return 0;

      if (selectedHabit.type === 'slider') {
        try {
          const config = JSON.parse(selectedHabit.config || '{}');
          const min = config.min ?? 0;
          const max = config.max ?? 10;
          return Math.max(0, Math.min((numericVal - min) / (max - min), 1));
        } catch {
          return Math.min(numericVal / 10, 1);
        }
      }
      
      if (selectedHabit.type === 'number') {
           const values = logs.map(l => parseFloat(l.value)).filter(v => !isNaN(v));
           const max = values.length > 0 ? Math.max(...values, 1) : 10;
           return Math.min(numericVal / max, 1);
      }
      return 0.5;
    };

    const getColor = (intensity: number) => {
      if (intensity === 0) return colors.surface1;
      const greenPalette = [
        `${colors.green}33`,
        `${colors.green}80`,
        `${colors.green}CC`,
        colors.green,
      ];
      const idx = Math.min(Math.floor(intensity * (greenPalette.length - 1)) + 1, greenPalette.length - 1);
      return greenPalette[idx];
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    };

    return (
      <View style={styles.heatmapCard}>
        <View style={styles.heatmapHeader}>
          <LayoutGrid size={18} color={colors.green} />
          <View style={{ flex: 1 }}>
             <Text style={styles.cardTitle}>Yearly Activity</Text>
             {selectedDate && (
               <Text style={styles.selectedDateText}>
                 {formatDate(selectedDate)}: {habitLogsMap[selectedDate] || 'No entries'}
               </Text>
             )}
          </View>
          <View style={styles.yearControls}>
            <Pressable onPress={() => { playSound('statistics'); setViewYear(v => v - 1); }} style={styles.yearBtn}><ChevronLeft size={16} color={colors.text} /></Pressable>
            <Text style={styles.yearText}>{viewYear}</Text>
            <Pressable onPress={() => { playSound('statistics'); setViewYear(v => v + 1); }} style={styles.yearBtn}><ChevronRight size={16} color={colors.text} /></Pressable>
          </View>
        </View>
        
        <ScrollView 
          ref={heatmapScrollRef}
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.heatmapScroll}
        >
          <View style={styles.heatmapGrid}>
            {weeks.map((week, weekIdx) => (
              <View key={`week-${weekIdx}`} style={styles.heatmapWeek}>
                {week.map((date, dayIdx) => (
                  <Pressable
                    key={`day-${weekIdx}-${dayIdx}`} 
                    onPress={() => { if (date) { playSound('statistics'); setSelectedDate(date); } }}
                    style={[
                      styles.heatmapDay, 
                      { backgroundColor: getColor(getIntensity(date)) },
                      selectedDate === date && { borderWidth: 2, borderColor: colors.text }
                    ]} 
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          {goalConfig ? (
            <View style={styles.modeSelector}>
              <Pressable 
                onPress={() => { playSound('statistics'); setHeatmapMode('value'); }} 
                style={[styles.modeBtn, heatmapMode === 'value' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeText, heatmapMode === 'value' && styles.modeTextActive]}>Value</Text>
              </Pressable>
              <Pressable 
                onPress={() => { playSound('statistics'); setHeatmapMode('goal'); }} 
                style={[styles.modeBtn, heatmapMode === 'goal' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeText, heatmapMode === 'goal' && styles.modeTextActive]}>Goal</Text>
              </Pressable>
            </View>
          ) : <View />}

          <View style={[styles.heatmapLegend, { marginTop: 0 }]}>
             <Text style={styles.legendText}>Less</Text>
             <View style={[styles.heatmapDay, { backgroundColor: colors.surface1 }]} />
             <View style={[styles.heatmapDay, { backgroundColor: `${colors.green}4D` }]} />
             <View style={[styles.heatmapDay, { backgroundColor: `${colors.green}99` }]} />
             <View style={[styles.heatmapDay, { backgroundColor: colors.green }]} />
             <Text style={styles.legendText}>More</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTrendGraph = () => {
    if (!selectedHabit || selectedHabit.type === 'checkbox') return null;

    const now = new Date();
    let displayLogs = [];
    if (selectedPeriod === 'Weekly') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      displayLogs = logs.filter(l => new Date(l.date) >= sevenDaysAgo);
    } else if (selectedPeriod === 'Monthly') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      displayLogs = logs.filter(l => new Date(l.date) >= thirtyDaysAgo);
    } else {
      displayLogs = logs;
    }

    if (displayLogs.length === 0) {
      return (
        <View style={styles.graphCard}>
          <Text style={styles.emptyText}>No data for this period</Text>
        </View>
      );
    }

    const numericLogs = displayLogs.map(l => {
        let v = 0;
        if (selectedHabit.type === 'time') {
            const [h, m] = l.value.split(':').map(Number);
            v = h * 60 + m;
        } else {
            v = parseFloat(l.value);
        }
        return { date: l.date, value: isNaN(v) ? 0 : v };
    });

    const values = numericLogs.map(l => l.value);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;

    return (
      <View style={styles.graphCard}>
        <View style={styles.graphHeader}>
          <LineChart size={18} color={colors.maroon} />
          <Text style={styles.cardTitle}>Trends</Text>
          <View style={styles.periodSelector}>
            {(['Weekly', 'Monthly', 'Yearly'] as Period[]).map(p => (
               <Pressable 
                key={p} 
                onPress={() => { playSound('statistics'); setSelectedPeriod(p); }}
                style={[styles.periodBtn, selectedPeriod === p && styles.periodBtnActive]}
               >
                 <Text style={[styles.periodText, selectedPeriod === p && styles.periodTextActive]}>{p}</Text>
               </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.chartArea}>
          <View style={styles.barsContainer}>
            {numericLogs.slice(-31).map((log, idx) => {
              const h = ((log.value - minVal) / (maxVal - minVal || 1)) * 100 + 10;
              return (
                <View key={log.date} style={styles.barWrapper}>
                   <View style={[styles.graphBar, { height: h, backgroundColor: colors.maroon }]} />
                </View>
              );
            })}
          </View>
          <View style={[styles.avgLine, { bottom: ((avgVal - minVal) / (maxVal - minVal || 1)) * 100 + 30 }]} />
          <Text style={[styles.avgText, { bottom: ((avgVal - minVal) / (maxVal - minVal || 1)) * 100 + 35 }]}>Avg: {selectedHabit.type === 'time' ? `${Math.floor(avgVal/60)}:${Math.floor(avgVal%60).toString().padStart(2,'0')}` : avgVal.toFixed(1)}</Text>
        </View>
      </View>
    );
  };

  return (
    <Animated.ScrollView style={[styles.container, tabAnimStyle]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>Create some habits to see statistics!</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.habitChips}>
            {habits.map(h => (
              <Pressable 
                key={h.id} 
                onPress={() => { playSound('statistics'); setSelectedHabit(h); }}
                style={[styles.habitChip, selectedHabit?.id === h.id && styles.habitChipActive]}
              >
                 <Text style={[styles.habitChipText, selectedHabit?.id === h.id && styles.habitChipTextActive]}>
                   {h.name}
                 </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
         <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <>
          {renderHeatmap()}
          {renderTrendGraph()}
          
          {selectedHabit && (
            <View style={styles.statsOverview}>
               <View style={styles.statBox}>
                 <Text style={styles.statLabel}>Days Logged</Text>
                 <Text style={styles.statValue}>{logs.length}</Text>
               </View>
               <View style={styles.statBox}>
                 <Text style={styles.statLabel}>Consistency</Text>
                 <Text style={styles.statValue}>
                   {((logs.length / 365) * 100).toFixed(1)}%
                 </Text>
               </View>
            </View>
          )}
        </>
      )}
    </Animated.ScrollView>
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  habitChips: {
    flexDirection: 'row',
  },
  habitChip: {
    backgroundColor: colors.surface0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.surface1,
  },
  habitChipActive: {
    backgroundColor: colors.primary + '25',
    borderColor: colors.primary,
  },
  habitChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  habitChipTextActive: {
    color: colors.primary,
  },
  heatmapCard: {
    backgroundColor: colors.backgroundElement,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.surface0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  selectedDateText: {
    fontSize: 12,
    color: colors.green,
    fontWeight: '600',
    marginTop: 2,
  },
  yearControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface0,
    borderRadius: 12,
    padding: 4,
  },
  yearBtn: {
    padding: 6,
  },
  yearText: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 14,
    marginHorizontal: 8,
  },
  heatmapScroll: {
    paddingBottom: 8,
  },
  heatmapGrid: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapWeek: {
    gap: 4,
  },
  heatmapDay: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    justifyContent: 'flex-end',
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  graphCard: {
    backgroundColor: colors.backgroundElement,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.surface0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface0,
    borderRadius: 12,
    padding: 3,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  periodBtnActive: {
    backgroundColor: colors.surface1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  periodText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  periodTextActive: {
    color: colors.text,
  },
  chartArea: {
    height: 180,
    justifyContent: 'flex-end',
    position: 'relative',
    paddingBottom: 30,
    marginTop: 10,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 120,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  graphBar: {
    width: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.maroon,
    opacity: 0.6,
    zIndex: 10,
  },
  avgText: {
    position: 'absolute',
    right: 0,
    color: colors.maroon,
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: colors.backgroundElement,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  statsOverview: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.backgroundElement,
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surface0,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  center: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface0,
    borderRadius: 8,
    padding: 3,
  },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: colors.surface2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modeTextActive: {
    color: colors.text,
  },
});
