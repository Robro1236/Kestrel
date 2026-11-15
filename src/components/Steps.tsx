import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { colors, fonts } from '../theme';

// One line of a list, instead of a run of paragraphs: a numbered badge when order matters (n), a small marker when it doesn't.
export function Step({ n, children }: { n?: number; children: ReactNode }) {
  return (
    <View style={styles.row}>
      {n == null ? (
        <View style={[styles.badge, styles.dot]}>
          <Icon name="chevronRight" size={12} color={colors.primary} weight={3} />
        </View>
      ) : (
        <View style={styles.badge}>
          <Text style={styles.num}>{n}</Text>
        </View>
      )}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

// A round tinted icon beside a card's heading.
export function IconBadge({ name }: { name: IconName }) {
  return (
    <View style={styles.icon}>
      <Icon name={name} size={22} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  badge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, marginTop: 1, backgroundColor: colors.primarySoft },
  num: { fontFamily: fonts.bold, fontSize: 13, color: colors.surface, fontVariant: ['tabular-nums'] },
  body: { flex: 1, paddingTop: 2 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
