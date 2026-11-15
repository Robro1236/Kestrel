import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

// Months are 0-based (JS Date), as expo-notifications' yearly trigger expects.
// shortcut: fixed dates for the US West (heat from May, fire from June), and US only since seasons flip in the south; use the area's hazards and hemisphere if we add regions.
export const REMINDERS = [
  { id: 'kit-heat', month: 4, day: 15, title: 'Heat season is coming', body: 'Check your kit: 3 days of water, and a cool place you can go.' },
  { id: 'kit-fire', month: 5, day: 15, title: 'Fire season is coming', body: 'Check your kit and go-bag, and sign up for county alerts.' },
];
const CHANNEL = 'kit-reminders';

// Phones only: local yearly notifications, no server. The web build shows nothing.
export function KitReminders({ inUs }: { inUs: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [problem, setProblem] = useState('');
  const show = inUs && Platform.OS !== 'web';

  useEffect(() => {
    if (!show) return;
    Notifications.getAllScheduledNotificationsAsync()
      .then((all) => setOn(all.some((n) => REMINDERS.some((r) => r.id === n.identifier))))
      .catch(() => setOn(false));
  }, [show]);

  if (!show || on === null) return null;

  const toggle = async () => {
    setProblem('');
    try {
      if (on) {
        await Promise.all(REMINDERS.map((r) => Notifications.cancelScheduledNotificationAsync(r.id)));
        return setOn(false);
      }
      const { granted } = await Notifications.requestPermissionsAsync();
      if (!granted) return setProblem('Notifications are off for Kestrel. Turn them on in your phone settings to get reminders.');
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Kit reminders', importance: Notifications.AndroidImportance.DEFAULT });
      }
      for (const r of REMINDERS) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: { title: r.title, body: r.body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.YEARLY, channelId: CHANNEL, month: r.month, day: r.day, hour: 9, minute: 0 },
        });
      }
      setOn(true);
    } catch {
      setProblem("Couldn't set reminders on this phone.");
    }
  };

  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={toggle} style={styles.row}>
        <Text style={styles.box}>{on ? '☑' : '☐'}</Text>
        <Text style={styles.text}>Remind me to check my kit before heat season (May 15) and fire season (June 15)</Text>
      </Pressable>
      {problem ? <Text accessibilityRole="alert" style={styles.problem}>{problem}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { fontSize: 22 },
  text: { flex: 1, fontSize: 15, color: '#1f1f1f' },
  problem: { fontSize: 14, color: '#7a1a12' },
});
