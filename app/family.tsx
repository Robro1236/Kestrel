import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, Share, Text, TextInput, View } from 'react-native';

import { Tap } from '../src/components/Tap';
import { styles } from '../src/components/familyCardStyles';
import { load, save } from '../src/storage';

// Fields follow Ready.gov's family emergency communication plan (https://www.ready.gov/plan).
export type FamilyPlan = {
  nearHome: string;
  outsideArea: string;
  contactName: string;
  contactPhone: string;
  contacts: string;
  medical: string;
  doctors: string;
  insurance: string;
  schools: string;
  pets: string;
  shutoffs: string;
  zone: string;
};

export const EMPTY_PLAN: FamilyPlan = {
  nearHome: '', outsideArea: '', contactName: '', contactPhone: '', contacts: '',
  medical: '', doctors: '', insurance: '', schools: '', pets: '', shutoffs: '', zone: '',
};

// On every card. Poison Help is the US national line (HRSA, https://poisonhelp.hrsa.gov), checked 2026-11-15.
export const KEY_NUMBERS = 'Emergency: 911. Poison Help: 1-800-222-1222 (US, 24 hours).';

const FIELDS: { key: keyof FamilyPlan; label: string; hint?: string; multiline?: boolean; phone?: boolean }[] = [
  { key: 'nearHome', label: 'Meeting place near home', hint: 'e.g. the mailbox at the corner, for a fire at home' },
  { key: 'outsideArea', label: 'Meeting place outside the neighborhood', hint: "e.g. a library or a friend's house, if you can't get home" },
  { key: 'contactName', label: 'Out-of-area contact', hint: 'Someone in another town everyone checks in with. Calls to them can get through when local lines are busy.' },
  { key: 'contactPhone', label: 'Their phone', phone: true },
  { key: 'contacts', label: 'Household phones', hint: 'One per line: name and number.', multiline: true },
  { key: 'medical', label: 'Medical needs', hint: "Each person's allergies, medicines and doses, conditions, and medical devices.", multiline: true },
  { key: 'doctors', label: 'Doctors and pharmacy', hint: 'Name and phone for each.', multiline: true },
  { key: 'insurance', label: 'Insurance', hint: 'Health, and home or renters: company, policy number and phone.', multiline: true },
  { key: 'schools', label: 'School, childcare and work', hint: 'Phone for each, and where they take people in an emergency.', multiline: true },
  { key: 'pets', label: 'Pets', hint: "Names, microchip numbers, the vet's phone, and a pet-friendly place to stay.", multiline: true },
  { key: 'shutoffs', label: 'Utility shutoffs', hint: 'Where the main water valve, gas meter and electric panel are, and any tool you need.', multiline: true },
  { key: 'zone', label: 'Evacuation zone', hint: "Your county's code for where you live. Look it up on your county's evacuation map." },
];

// Plain text of the filled-in fields, for sharing from a phone.
export function planText(p: FamilyPlan): string {
  const lines = FIELDS.filter((f) => p[f.key].trim()).map((f) => `${f.label}: ${p[f.key].trim()}`);
  return ['Our family emergency plan', ...lines].join('\n');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Printable page of the card. Empty fields stay as blank lines to fill in by hand. Typed text is escaped.
export function cardHtml(p: FamilyPlan): string {
  const rows = FIELDS.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(p[f.key].trim()).replace(/\n/g, '<br>')}</dd>`).join('');
  return `<!DOCTYPE html><html><head><title>Family emergency plan</title><style>
body{font:14px/1.45 system-ui,sans-serif;color:#0f172a;margin:32px}h1{font-size:22px;margin:0 0 16px}
dt{font-weight:700;margin-top:14px}dd{margin:4px 0 0;min-height:22px;border-bottom:1px solid #94a3b8;padding-bottom:4px}
p{color:#64748b;font-size:11px;margin-top:24px}</style></head><body><h1>Our family emergency plan</h1><dl>${rows}</dl>
<h2 style="font-size:15px;margin-top:20px">${esc(KEY_NUMBERS)}</h2>
<p>Source: Ready.gov, Make a Plan; Poison Help, HRSA. Made with Kestrel.</p></body></html>`;
}

// The app scrolls inside a fixed-height view, so window.print() would print one clipped screen. Print a plain copy from a hidden frame.
function printWeb(p: FamilyPlan) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const win = frame.contentWindow!;
  win.document.open();
  win.document.write(cardHtml(p));
  win.document.close();
  win.onafterprint = () => frame.remove();
  win.focus();
  win.print();
}

export default function Family() {
  const router = useRouter();
  const [plan, setPlan] = useState<FamilyPlan>(EMPTY_PLAN);

  useEffect(() => {
    load<FamilyPlan>('familyPlan').then((p) => p && setPlan({ ...EMPTY_PLAN, ...p }));
  }, []);

  const set = (key: keyof FamilyPlan, value: string) =>
    setPlan((p) => {
      const next = { ...p, [key]: value };
      save('familyPlan', next);
      return next;
    });

  const print = () => (Platform.OS === 'web' ? printWeb(plan) : Share.share({ message: `${planText(plan)}\n${KEY_NUMBERS}` }));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Family plan card</Text>
      <Text style={styles.note}>Fill it in together, then print it or share it so everyone has a copy. It is saved on this device only.</Text>
      <Text style={styles.label}>{KEY_NUMBERS}</Text>
      </View>

      <View style={styles.card}>
      {FIELDS.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={styles.label} nativeID={`label-${f.key}`}>{f.label}</Text>
          {f.hint ? <Text style={styles.hint}>{f.hint}</Text> : null}
          <TextInput
            accessibilityLabel={f.label}
            aria-labelledby={`label-${f.key}`}
            style={[styles.input, f.multiline && styles.multiline]}
            value={plan[f.key]}
            onChangeText={(v) => set(f.key, v)}
            multiline={f.multiline}
            keyboardType={f.phone ? 'phone-pad' : 'default'}
          />
        </View>
      ))}
      </View>

      <Tap accessibilityRole="button" style={styles.primary} onPress={print}>
        <Text style={styles.primaryText}>{Platform.OS === 'web' ? 'Print' : 'Share'}</Text>
      </Tap>
      <Tap accessibilityRole="link" onPress={() => router.replace('/plan')} style={styles.linkHit}>
        <Text style={styles.link}>Back to your plan</Text>
      </Tap>
      <Text style={styles.source}>Source: Ready.gov, Make a Plan.</Text>
    </ScrollView>
  );
}
