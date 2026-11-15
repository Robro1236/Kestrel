import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { Header } from '../src/components/Header';
import { ScreenFade } from '../src/components/ScreenFade';
import { colors } from '../src/theme';

export default function RootLayout() {
  // Fonts ship in the bundle. Never wait on them: until they load (or if they fail) text uses the system font.
  useFonts({ InstrumentSerif_400Regular, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  return (
    <Stack
      // Native stacks already animate between screens; web needs its own ease-in.
      screenLayout={Platform.OS === 'web' ? ({ children }) => <ScreenFade>{children}</ScreenFade> : undefined}
      screenOptions={{
        title: 'Kestrel',
        // No back arrow: the menu is the navigation. Our own header, so it can hide on scroll.
        // Rendered as an element: navigation calls header() as a plain function, which would run Header's hooks inline.
        header: (props) => <Header {...props} />,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
