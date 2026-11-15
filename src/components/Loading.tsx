import { ActivityIndicator, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: colors.primary }}>Loading</Text>
    </View>
  );
}
