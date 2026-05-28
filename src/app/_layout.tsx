import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase, seedHabitsIfEmpty } from '@/database';
import { Colors } from '@/constants/theme';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { SoundProvider } from '@/hooks/useSound';
import { setupNotificationHandler } from '@/hooks/useNotifications';

function AppContent() {
  const { colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack screenOptions={{ 
        headerStyle: { backgroundColor: colors.backgroundElement },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background }
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'none',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

function SplashScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <Image source={require('../../tsuu_logo.png')} style={{ width: 120, height: 120, resizeMode: 'contain' }} />
      <Text style={{ color: colors.text, marginTop: 16, fontSize: 24, fontWeight: 'bold' }}>Tsuu</Text>
    </View>
  );
}

function RootContent() {
  const [dbReady, setDbReady] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function setupDb() {
      try {
        await initDatabase();
        await seedHabitsIfEmpty();
        await setupNotificationHandler();
        setDbReady(true);
      } catch (e) {
        console.error('Failed to initialize database', e);
      }
    }
    setupDb();
  }, []);

  if (!dbReady || !minTimePassed) {
    return <SplashScreen />;
  }

  return (
    <SoundProvider>
      <AppContent />
    </SoundProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
