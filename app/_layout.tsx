import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '../src/components/Header';
import { ScreenFade } from '../src/components/ScreenFade';
import { colors } from '../src/theme';

export default function RootLayout() {
  // Fonts ship in the bundle. Never wait on them: until they load (or if they fail) text uses the system font.
  useFonts({ InstrumentSerif_400Regular, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  const bottom = useSafeAreaInsets().bottom;
  useEffect(registerOffline, []);
  return (
    <Stack
      // Native stacks already animate between screens; web needs its own ease-in.
      screenLayout={Platform.OS === 'web' ? ({ children }) => <ScreenFade>{children}</ScreenFade> : undefined}
      screenOptions={{
        title: 'Kestrel',
        // No back arrow: the menu is the navigation. Our own header, so it can hide on scroll.
        // Rendered as an element: navigation calls header() as a plain function, which would run Header's hooks inline.
        header: (props) => <Header {...props} />,
        // Web: the header floats over the page and slides; ui.screen leaves room for it (headerPad).
        headerTransparent: Platform.OS === 'web',
        // Bottom inset keeps the last card clear of the iPhone home indicator and the Android nav bar (edge-to-edge).
        contentStyle: { backgroundColor: colors.bg, paddingBottom: bottom },
      }}
    />
  );
}

// Web build only: a service worker so a reload with no connection still opens the app (public/sw.js). Phones ship the app itself.
function registerOffline() {
  if (Platform.OS !== 'web' || __DEV__ || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Offline support unavailable', e));
}
