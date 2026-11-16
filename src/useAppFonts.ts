import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';

// The app's fonts (names in theme.ts). [loaded, error]; already-loaded fonts report loaded on the first render.
export const useAppFonts = () =>
  useFonts({ InstrumentSerif_400Regular, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
