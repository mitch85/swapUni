import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BlockedScreen } from '@/components/blocked';
import { ConfirmHost } from '@/components/confirm';
import { Splash } from '@/components/splash';
import { Colors } from '@/constants/theme';
import { AppProvider, useApp } from '@/lib/app-state';
import { usePushNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const MIN_SPLASH_MS = 1200;

function RootNavigator() {
  const { session, loaded, myRequest, profile } = useApp();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const signedIn = !!session;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  usePushNotifications(signedIn);

  if (session === undefined || (signedIn && !loaded) || !minTimePassed) {
    return (
      <>
        <StatusBar style="light" />
        <Splash />
      </>
    );
  }

  if (profile?.blocked) {
    return (
      <>
        <StatusBar style="dark" />
        <BlockedScreen />
      </>
    );
  }

  const hasRequest = !!myRequest;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !hasRequest}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && hasRequest}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="request" options={{ presentation: 'modal' }} />
          <Stack.Screen name="match/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="universities/index" />
          <Stack.Screen name="universities/[id]" />
        </Stack.Protected>
      </Stack>
      <ConfirmHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
