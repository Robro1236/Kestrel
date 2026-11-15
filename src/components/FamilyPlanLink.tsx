import { useRouter } from 'expo-router';
import { type StyleProp, Text, type TextStyle, type ViewStyle } from 'react-native';

import { Tap } from './Tap';

// Entry point to the family plan card (app/family.tsx); the plan screen passes its chip style.
export function FamilyPlanLink({ style, textStyle }: { style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  const router = useRouter();
  return (
    <Tap accessibilityRole="link" onPress={() => router.push('/family')} style={style}>
      <Text style={textStyle}>Family plan card</Text>
    </Tap>
  );
}
