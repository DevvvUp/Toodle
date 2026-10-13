import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { FiraCode_400Regular } from '@expo-google-fonts/fira-code';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text } from 'react-native';
import DebugBanner from '../src/components/DebugBanner';
import { theme } from '../src/theme';

// @ts-ignore
import '../global.css';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, padding: 20, justifyContent: 'center' }}>
      <Text style={{ color: theme.colors.risk.critical, fontSize: 20, fontWeight: 'bold', fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing, marginBottom: 10 }}>Runtime Error</Text>
      <Text style={{ color: theme.colors.ink, fontFamily: theme.typography.body.fontFamily, letterSpacing: theme.typography.body.letterSpacing, marginBottom: 20 }}>{error.message}</Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ 
    Inter_400Regular, 
    Inter_500Medium, 
    Inter_600SemiBold, 
    Inter_700Bold, 
    FiraCode_400Regular 
  });
  const [timeoutPassed, setTimeoutPassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeoutPassed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || timeoutPassed) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, timeoutPassed]);

  const showDebug = process.env.EXPO_PUBLIC_DEBUG === '1';

  if (!fontsLoaded && !fontError && !timeoutPassed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
        {showDebug && <DebugBanner />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {showDebug && <DebugBanner />}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}