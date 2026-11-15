import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { Platform, Text } from 'react-native';

import { Menu } from '../src/components/Menu';
import { ScreenFade } from '../src/components/ScreenFade';
import { Tap } from '../src/components/Tap';
import { colors, fonts } from '../src/theme';

export default function RootLayout() {
  // Fonts ship in the bundle. Never wait on them: until they load (or if they fail) text uses the system font.
  const router = useRouter();
  useFonts({ InstrumentSerif_400Regular, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  return (
    <Stack
      // Native stacks already animate between screens; web needs its own ease-in.
      screenLayout={Platform.OS === 'web' ? ({ children }) => <ScreenFade>{children}</ScreenFade> : undefined}
      screenOptions={{
        title: 'Kestrel',
        // No back arrow: the menu is the navigation. Web ignores headerBackVisible, so headerLeft too.
        headerBackVisible: false,
        headerLeft: () => null,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        // The wordmark is a way home: it opens the plan (which sends a new user to setup).
        headerTitle: () => (
          <Tap accessibilityRole="link" accessibilityLabel="Kestrel, go to your plan" onPress={() => router.navigate('/plan')}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>Kestrel</Text>
          </Tap>
        ),
        headerRight: () => <Menu />,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: '' }} />
    </Stack>
  );
}
