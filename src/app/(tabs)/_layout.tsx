import { View, Image, Text, Pressable } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { CalendarDays, BarChart3, Settings } from 'lucide-react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.backgroundElement },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.mantle,
          borderTopColor: colors.surface0,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.overlay1,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Timeline',
          headerTitle: '',
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 }}>
              <Image 
                source={require('../../../tsuu_logo.png')} 
                style={{ width: 32, height: 32, borderRadius: 8 }} 
              />
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 }}>Tsuu</Text>
            </View>
          ),
          headerRight: () => (
            <Pressable 
              onPress={() => router.push('/manage')}
              style={({ pressed }) => ({
                marginRight: 16,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Settings color={colors.text} size={24} />
            </Pressable>
          ),
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          tabBarLabel: 'Statistics',
          headerTitle: '',
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 }}>
              <Image 
                source={require('../../../tsuu_logo.png')} 
                style={{ width: 32, height: 32, borderRadius: 8 }} 
              />
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 }}>Tsuu</Text>
            </View>
          ),
          headerRight: () => (
            <Pressable 
              onPress={() => router.push('/manage')}
              style={({ pressed }) => ({
                marginRight: 16,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Settings color={colors.text} size={24} />
            </Pressable>
          ),
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          href: null,
          title: 'Manage',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
