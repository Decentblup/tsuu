import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, FlatList, StyleSheet, Dimensions, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { DayLogEntry } from '@/components/DayLogEntry';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function TimelineScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [dates, setDates] = useState<string[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  useEffect(() => {
    const generatedDates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
        generatedDates.push(localISOTime);
    }
    setDates(generatedDates);
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={dates}
        scrollEnabled={scrollEnabled}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        decelerationRate="fast"
        snapToAlignment="start"
        disableIntervalMomentum={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1 }}>
             <DayLogEntry date={item} onScrollChange={setScrollEnabled} />
          </View>
        )}
      />
      {dates.length > 1 && (
        <View style={styles.indicatorContainer}>
          {currentIndex > 0 && (
            <View style={styles.arrowHint}>
              <ChevronLeft size={14} color={colors.overlay1} />
              <Text style={styles.arrowText}>newer</Text>
            </View>
          )}
          {currentIndex === 0 && <View style={styles.arrowPlaceholder} />}
          
          <View style={styles.dots}>
            {dates.slice(
              Math.max(0, currentIndex - 2),
              Math.min(dates.length, currentIndex + 3)
            ).map((date, i) => {
              const actualIndex = Math.max(0, currentIndex - 2) + i;
              const isCurrent = actualIndex === currentIndex;
              return (
                <View
                  key={date}
                  style={[
                    styles.dot,
                    isCurrent && styles.dotActive,
                    !isCurrent && Math.abs(actualIndex - currentIndex) === 2 && styles.dotFar,
                  ]}
                />
              );
            })}
          </View>

          {currentIndex < dates.length - 1 && (
            <View style={styles.arrowHint}>
              <Text style={styles.arrowText}>older</Text>
              <ChevronRight size={14} color={colors.overlay1} />
            </View>
          )}
          {currentIndex === dates.length - 1 && <View style={styles.arrowPlaceholder} />}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface2,
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dotFar: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  arrowHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  arrowText: {
    color: colors.overlay1,
    fontSize: 11,
    fontWeight: '600',
  },
  arrowPlaceholder: {
    width: 50,
  },
});
