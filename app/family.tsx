import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, ScrollView, Share, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { Icon } from '../src/components/Icon';
import { Tap } from '../src/components/Tap';
import { styles } from '../src/components/familyCardStyles';
import type { Household } from '../src/kit/rules';
import { colors } from '../src/theme';
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
  { key: 'pets', label: 'Pet details', hint: "Names, microchip numbers, the vet's phone, and a pet-friendly place to stay.", multiline: true },
  { key: 'shutoffs', label: 'Utility shutoffs', hint: 'Where the main water valve, gas meter and electric panel are, and any tool you need.', multiline: true },
  { key: 'zone', label: 'Evacuation zone', hint: "Your county's code for where you live. Look it up on your county's evacuation map." },
];

// One card per topic (docs/DESIGN.md).
const GROUPS: [string, (keyof FamilyPlan)[]][] = [
  ['Where to meet', ['nearHome', 'outsideArea']],
  ['Who to call', ['contactName', 'contactPhone', 'contacts']],
  ['Health', ['medical', 'doctors', 'insurance']],
  ['School and work', ['schools']],
  ['Pets', ['pets']],
  ['Home', ['shutoffs', 'zone']],
];

// "Dog", "Dog 2", "Cat": one photo slot per pet in the household.
export function petSlots(h: Pick<Household, 'dogs' | 'cats'> | null): string[] {
  const n = (kind: string, count: number) => Array.from({ length: count }, (_, i) => (i ? `${kind} ${i + 1}` : kind));
  return [...n('Dog', h?.dogs ?? 0), ...n('Cat', h?.cats ?? 0)];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "2 adults, 1 infant, 1 dog" for the card's header.
export function householdSummary(h: Household): string {
  const parts: [number, string, string?][] = [[h.adults, 'adult'], [h.seniors, 'senior'], [h.children, 'child', 'children'], [h.infants, 'infant'], [h.dogs, 'dog'], [h.cats, 'cat']];
  return parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many)).join(', ');
}

// Section titles and hints that fit this household. Without a household, the general card.
export function tailor(h: Household | null): { titles: Record<string, string>; hints: Partial<Record<keyof FamilyPlan, string>> } {
  if (!h) return { titles: {}, hints: {} };
  const people = h.adults + h.seniors + h.children + h.infants;
  const hints: Partial<Record<keyof FamilyPlan, string>> = {};
  if (people > 1) hints.contacts = `One per line: name and number for each of the ${people} people.`;
  const medical = [
    h.medication ? 'Someone takes daily medicine: list each one and the dose.' : '',
    h.mobility ? 'Someone needs help to get around: note who helps them leave and any equipment they use.' : '',
    h.infants ? "The baby's formula, food and any medicine." : '',
  ].filter(Boolean);
  if (medical.length) hints.medical = `Each person's allergies, medicines, conditions and devices. ${medical.join(' ')}`;
  const kids = h.children + h.infants > 0;
  if (!kids) hints.schools = 'Phone for each workplace, and where they take people in an emergency.';
  return { titles: kids ? {} : { 'School and work': 'Work' }, hints };
}

// Shrinks the photo so a few fit in browser storage (~5 MB) and on the printed card.
async function pickPhoto(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
  if (r.canceled) return null;
  const ref = await ImageManipulator.manipulate(r.assets[0].uri).resize({ width: 480 }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${out.base64}`;
}

// Plain text of the filled-in fields, for sharing from a phone.
export function planText(p: FamilyPlan): string {
  const lines = FIELDS.filter((f) => p[f.key].trim()).map((f) => `${f.label}: ${p[f.key].trim()}`);
  return ['Our family emergency plan', ...lines].join('\n');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Printable page of the card. Empty fields stay as blank lines to fill in by hand. Typed text is escaped.
// Pets are left off for a household without any; pet photos print under the Pets line. Only our own JPEG data URLs are printed.
export function cardHtml(p: FamilyPlan, { pets = true, photos = [] }: { pets?: boolean; photos?: string[] } = {}): string {
  const imgs = photos.filter((u) => u?.startsWith('data:image/jpeg;base64,')).map((u) => `<img src="${esc(u)}" alt="">`).join('');
  const rows = FIELDS.filter((f) => pets || f.key !== 'pets')
    .map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(p[f.key].trim()).replace(/\n/g, '<br>')}</dd>${f.key === 'pets' && imgs ? `<dd class="photos">${imgs}</dd>` : ''}`)
    .join('');
  return `<!DOCTYPE html><html><head><title>Family emergency plan</title><style>
body{font:14px/1.45 system-ui,sans-serif;color:#0f172a;margin:32px}h1{font-size:22px;margin:0 0 16px}
dt{font-weight:700;margin-top:14px}dd{margin:4px 0 0;min-height:22px;border-bottom:1px solid #94a3b8;padding-bottom:4px}
p{color:#64748b;font-size:11px;margin-top:24px}.photos{border:0}.photos img{width:120px;height:120px;object-fit:cover;border-radius:8px;margin:6px 8px 0 0}</style></head><body><h1>Our family emergency plan</h1><dl>${rows}</dl>
<h2 style="font-size:15px;margin-top:20px">${esc(KEY_NUMBERS)}</h2>
<p>Source: Ready.gov, Make a Plan and Pets; Poison Help, HRSA. Made with Kestrel.</p></body></html>`;
}

// The app scrolls inside a fixed-height view, so window.print() would print one clipped screen. Print a plain copy from a hidden frame.
function printWeb(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const win = frame.contentWindow!;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = () => frame.remove();
  win.focus();
  win.print();
}

export default function Family() {
  const router = useRouter();
  const [plan, setPlan] = useState<FamilyPlan>(EMPTY_PLAN);
  const [household, setHousehold] = useState<Household | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    load<FamilyPlan>('familyPlan').then((p) => p && setPlan({ ...EMPTY_PLAN, ...p }));
    load<Household>('household').then(setHousehold);
    load<string[]>('petPhotos').then((p) => p && setPhotos(p));
  }, []);

  const set = (key: keyof FamilyPlan, value: string) =>
    setPlan((p) => {
      const next = { ...p, [key]: value };
      save('familyPlan', next);
      return next;
    });

  const slots = petSlots(household);
  const { titles, hints } = tailor(household);
  // Shown when we don't know the household yet, for a household with pets, and for anyone who already filled it in.
  const hasPets = !household || slots.length > 0 || !!plan.pets.trim() || photos.some(Boolean);
  const setPhoto = (i: number, uri: string) =>
    setPhotos((ps) => {
      const next = [...ps];
      next[i] = uri;
      save('petPhotos', next);
      return next;
    });
  const addPhoto = async (i: number) => {
    setPhotoError(null);
    try {
      const uri = await pickPhoto();
      if (uri) setPhoto(i, uri);
    } catch {
      setPhotoError("Couldn't add that photo. Try another one.");
    }
  };

  const print = () =>
    Platform.OS === 'web' ? printWeb(cardHtml(plan, { pets: hasPets, photos })) : Share.share({ message: `${planText(plan)}\n${KEY_NUMBERS}` });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Family plan card</Text>
        <Text style={styles.note}>Fill it in together, then print it or share it so everyone has a copy. It is saved on this device only.</Text>
        <Text style={styles.label}>{KEY_NUMBERS}</Text>
        <Text style={styles.note}>{household ? `Made for your household: ${householdSummary(household)}.` : 'Set up your household and this card fits who lives with you.'}</Text>
        <Tap accessibilityRole="link" onPress={() => router.push('/setup')} style={styles.linkHit}>
          <Text style={styles.link}>{household ? 'Edit household' : 'Set up household'}</Text>
        </Tap>
      </View>

      {GROUPS.filter(([title]) => title !== 'Pets' || hasPets).map(([title, keys]) => (
        <View key={title} style={styles.card}>
          <Text accessibilityRole="header" style={styles.groupTitle}>{titles[title] ?? title}</Text>
          {FIELDS.filter((f) => keys.includes(f.key)).map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label} nativeID={`label-${f.key}`}>{f.label}</Text>
              {hints[f.key] ?? f.hint ? <Text style={styles.hint}>{hints[f.key] ?? f.hint}</Text> : null}
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
          {title === 'Pets' ? (
            <View style={styles.field}>
              <Text style={styles.label}>Photos</Text>
              <Text style={styles.hint}>A recent photo of each pet, ideally with you in it, helps prove they're yours and helps others find them if you get separated.</Text>
              <View style={styles.photos}>
                {(slots.length ? slots : ['Pet']).map((name, i) => (
                  <View key={name} style={styles.photoSlot}>
                    {photos[i] ? (
                      <View>
                        <Image source={{ uri: photos[i] }} style={styles.photo} accessibilityLabel={`Photo of ${name.toLowerCase()}`} />
                        <Tap accessibilityRole="button" accessibilityLabel={`Remove photo of ${name.toLowerCase()}`} onPress={() => setPhoto(i, '')} style={styles.removePhoto}>
                          <View style={styles.removeDot}>
                            <Icon name="close" size={14} color={colors.surface} />
                          </View>
                        </Tap>
                      </View>
                    ) : (
                      <Tap accessibilityRole="button" accessibilityLabel={`Add a photo of ${name.toLowerCase()}`} onPress={() => addPhoto(i)} style={[styles.photo, styles.addPhoto]}>
                        <Icon name="plus" size={22} color={colors.primary} />
                        <Text style={styles.addPhotoText}>Add photo</Text>
                      </Tap>
                    )}
                    <Text style={styles.photoName}>{name}</Text>
                  </View>
                ))}
              </View>
              {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
            </View>
          ) : null}
        </View>
      ))}

      {!hasPets ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.groupTitle}>Pets</Text>
          <Text style={styles.note}>No pets in your household. Add them and you get a section for their details and photos.</Text>
          <Tap accessibilityRole="link" onPress={() => router.push('/setup')} style={styles.linkHit}>
            <Text style={styles.link}>Add pets</Text>
          </Tap>
        </View>
      ) : null}

      <Tap accessibilityRole="button" style={styles.primary} onPress={print}>
        <Text style={styles.primaryText}>{Platform.OS === 'web' ? 'Print' : 'Share'}</Text>
      </Tap>
      <Tap accessibilityRole="link" onPress={() => router.replace('/plan')} style={styles.linkHit}>
        <Text style={styles.link}>Back to your plan</Text>
      </Tap>
      <Text style={styles.source}>Source: Ready.gov, Make a Plan and Pets.</Text>
    </ScrollView>
  );
}
