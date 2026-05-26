import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase, seedHabitsIfEmpty } from '@/database';
import { Colors } from '@/constants/theme';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { SoundProvider } from '@/hooks/useSound';
import { setupNotificationHandler } from '@/hooks/useNotifications';

function AppContent() {
  const { colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

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

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.background }}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={{ color: Colors.dark.text, marginTop: 16 }}>Loading Habit Tracker...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SoundProvider>
        <AppContent />
      </SoundProvider>
    </ThemeProvider>
  );
}
