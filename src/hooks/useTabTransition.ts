import { useCallback } from 'react';
import { Dimensions, InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS
} from 'react-native-reanimated';

const SLIDE_DISTANCE = Dimensions.get('window').width * 0.15;

export function useTabTransition(direction: 'left' | 'right', isInitial: boolean = false) {
  const offset = direction === 'right' ? SLIDE_DISTANCE : -SLIDE_DISTANCE;
  const translateX = useSharedValue(isInitial ? 0 : offset);
  const opacity = useSharedValue(isInitial ? 1 : 0);

  useFocusEffect(
    useCallback(() => {
      const handle = InteractionManager.createInteractionHandle();
      const clearHandle = () => {
        InteractionManager.clearInteractionHandle(handle);
      };
      
      translateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(clearHandle)();
      });
      return () => {
        translateX.value = offset;
        opacity.value = 0;
        runOnJS(clearHandle)();
      };
    }, [])
  );

  return useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));
}
