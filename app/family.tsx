import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Share, Text, TextInput, View } from 'react-native';
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
  homeInsurance: string;
  zone: string;
};

export const EMPTY_PLAN: FamilyPlan = {
  nearHome: '', outsideArea: '', contactName: '', contactPhone: '', contacts: '',
  medical: '', doctors: '', insurance: '', schools: '', pets: '', shutoffs: '', homeInsurance: '', zone: '',
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
  { key: 'homeInsurance', label: 'Home or renters insurance', hint: 'Company, policy number and phone.', multiline: true },
  { key: 'zone', label: 'Evacuation zone', hint: "Your county's code for where you live. Look it up on your county's evacuation map." },
];

// One card per topic (docs/DESIGN.md).
const GROUPS: [string, (keyof FamilyPlan)[]][] = [
  ['Where to meet', ['nearHome', 'outsideArea']],
  ['Who to call', ['contactName', 'contactPhone', 'contacts']],
  ['Health', ['medical', 'doctors', 'insurance']],
  ['School and work', ['schools']],
  ['Pets', ['pets']],
  ['Home', ['shutoffs', 'homeInsurance', 'zone']],
];

// "Dog", "Dog 2", "Cat": one photo slot per pet in the household.
export function petSlots(h: Pick<Household, 'dogs' | 'cats'> | null): string[] {
  const n = (kind: string, count: number) => Array.from({ length: count }, (_, i) => (i ? `${kind} ${i + 1}` : kind));
  return [...n('Dog', h?.dogs ?? 0), ...n('Cat', h?.cats ?? 0)];
}

// One page per person: their phone, health and school or work. The rest of the card is shared.
export type Member = { name: string; phone: string; medical: string; doctors: string; insurance: string; school: string };
const EMPTY_MEMBER: Member = { name: '', phone: '', medical: '', doctors: '', insurance: '', school: '' };
type Kind = 'adult' | 'senior' | 'child' | 'infant';
// The household's phones, health and school fields move onto each person's page; kept if already filled in.
const PER_PERSON: (keyof FamilyPlan)[] = ['contacts', 'medical', 'doctors', 'insurance', 'schools'];
// Without a household, the one Insurance field covers the home too.
const hiddenWhenEmpty = (perPerson: boolean) => (perPerson ? PER_PERSON : ['homeInsurance']);

// "Adult", "Adult 2", "Child": one page per person in the household.
export function memberSlots(h: Partial<Household> | null): { kind: Kind; label: string }[] {
  const kinds: [Kind, string, number][] = [['adult', 'Adult', h?.adults ?? 0], ['senior', 'Senior', h?.seniors ?? 0], ['child', 'Child', h?.children ?? 0], ['infant', 'Infant', h?.infants ?? 0]];
  return kinds.flatMap(([kind, label, n]) => Array.from({ length: n }, (_, i) => ({ kind, label: i ? `${label} ${i + 1}` : label })));
}

// A person's page as label/value rows, for printing and sharing.
export type MemberPage = { name: string; rows: [string, string][] };

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
  if (medical.length) hints.medical = `Allergies, medicines and doses, conditions, and medical devices. ${medical.join(' ')}`;
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
export function planText(p: FamilyPlan, members: MemberPage[] = []): string {
  const lines = FIELDS.filter((f) => p[f.key].trim()).map((f) => `${f.label}: ${p[f.key].trim()}`);
  const people = members.flatMap((m) => m.rows.filter(([, v]) => v.trim()).map(([l, v]) => `${m.name}, ${l.toLowerCase()}: ${v.trim()}`));
  return ['Our family emergency plan', ...lines, ...people].join('\n');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Printable page of the card. Empty fields stay as blank lines to fill in by hand. Typed text is escaped.
// Pets are left off for a household without any; pet photos print under the Pets line. Only our own JPEG data URLs are printed.
// With members, each person gets their own section after the shared one.
export function cardHtml(p: FamilyPlan, { pets = true, photos = [], members }: { pets?: boolean; photos?: string[]; members?: MemberPage[] } = {}): string {
  const imgs = photos.filter((u) => u?.startsWith('data:image/jpeg;base64,')).map((u) => `<img src="${esc(u)}" alt="">`).join('');
  const row = (label: string, value: string) => `<dt>${esc(label)}</dt><dd>${esc(value.trim()).replace(/\n/g, '<br>')}</dd>`;
  const rows = FIELDS.filter((f) => (pets || f.key !== 'pets') && (!hiddenWhenEmpty(!!members).includes(f.key) || p[f.key].trim()))
    .map((f) => `${row(f.label, p[f.key])}${f.key === 'pets' && imgs ? `<dd class="photos">${imgs}</dd>` : ''}`)
    .join('');
  const people = (members ?? []).map((m) => `<h2>${esc(m.name)}</h2><dl>${m.rows.map(([l, v]) => row(l, v)).join('')}</dl>`).join('');
  return `<!DOCTYPE html><html><head><title>Family emergency plan</title><style>
body{font:14px/1.45 system-ui,sans-serif;color:#0f172a;margin:32px}h1{font-size:22px;margin:0 0 16px}
dt{font-weight:700;margin-top:14px}dd{margin:4px 0 0;min-height:22px;border-bottom:1px solid #94a3b8;padding-bottom:4px}
p{color:#64748b;font-size:11px;margin-top:24px}.photos{border:0}h2{font-size:17px;margin:24px 0 0}.photos img{width:120px;height:120px;object-fit:cover;border-radius:8px;margin:6px 8px 0 0}</style></head><body><h1>Our family emergency plan</h1><dl>${rows}</dl>${people}
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
  const [members, setMembers] = useState<Member[]>([]);
  const [who, setWho] = useState(0);

  useEffect(() => {
    load<FamilyPlan>('familyPlan').then((p) => p && setPlan({ ...EMPTY_PLAN, ...p }));
    load<Household>('household').then(setHousehold);
    load<string[]>('petPhotos').then((p) => p && setPhotos(p));
    load<Member[]>('familyMembers').then((m) => m && setMembers(m));
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
  const people = memberSlots(household);
  const perPerson = people.length > 0;
  const member = (i: number): Member => ({ ...EMPTY_MEMBER, ...members[i] });
  const nameOf = (i: number) => member(i).name.trim() || people[i].label;
  const schoolLabel = (k: Kind) => (k === 'child' ? 'School' : k === 'infant' ? 'Childcare' : titles['School and work'] ?? 'School and work');
  const pages: MemberPage[] = people.map((pp, i) => ({ name: nameOf(i), rows: [
    ['Phone', member(i).phone], ['Medical needs', member(i).medical], ['Doctors and pharmacy', member(i).doctors],
    ['Health insurance', member(i).insurance], [schoolLabel(pp.kind), member(i).school],
  ] }));
  const setMember = (key: keyof Member, value: string) =>
    setMembers((ms) => {
      const next = [...ms];
      next[who] = { ...member(who), [key]: value };
      save('familyMembers', next);
      return next;
    });
  // On a per-person card, the shared phones, health and school fields show only if they were filled in before.
  const shown = (keys: (keyof FamilyPlan)[]) => FIELDS.filter((f) => keys.includes(f.key) && (!hiddenWhenEmpty(perPerson).includes(f.key) || plan[f.key].trim()));

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
    Platform.OS === 'web' ? printWeb(cardHtml(plan, { pets: hasPets, photos, members: perPerson ? pages : undefined })) : Share.share({ message: `${planText(plan, pages)}\n${KEY_NUMBERS}` });

  // Android: edge-to-edge stops the window resizing for the keyboard, so lift the form ourselves. iOS uses automaticallyAdjustKeyboardInsets.
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'height' : undefined} enabled={Platform.OS === 'android'}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Family plan card</Text>
        <Text style={styles.note}>Fill it in together, then print it or share it so everyone has a copy. It is saved on this device only.</Text>
        <Text style={styles.label}>{KEY_NUMBERS}</Text>
        <Text style={styles.note}>{household ? `Made for your household: ${householdSummary(household)}.` : 'Set up your household and this card fits who lives with you.'}</Text>
        <Tap accessibilityRole="link" onPress={() => router.push('/setup')} style={styles.linkHit}>
          <Text style={styles.link}>{household ? 'Edit household' : 'Set up household'}</Text>
        </Tap>
      </View>

      {perPerson && people[who] ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.groupTitle}>Each person</Text>
          <Text style={styles.hint}>A page for each person in your household. Tap a name to switch. Print puts everyone on one card.</Text>
          <View style={styles.chips}>
            {people.map((pp, i) => (
              <Tap key={pp.label} accessibilityRole="tab" accessibilityState={{ selected: i === who }} onPress={() => setWho(i)} style={[styles.chip, i === who && styles.chipOn]}>
                <Text style={[styles.chipText, i === who && styles.chipTextOn]}>{nameOf(i)}</Text>
              </Tap>
            ))}
          </View>
          {([
            ['name', 'Name', 'e.g. Dad, or their first name.', false],
            ['phone', 'Phone', 'Their cell phone, if they have one.', false, true],
            ['medical', 'Medical needs', hints.medical ?? 'Allergies, medicines and doses, conditions, and medical devices.', true],
            ['doctors', 'Doctors and pharmacy', 'Name and phone for each.', true],
            ['insurance', 'Health insurance', 'Company, policy number and phone.', true],
            ['school', schoolLabel(people[who].kind), 'Phone, and where they take people in an emergency.', true],
          ] as [keyof Member, string, string, boolean, boolean?][]).map(([key, label, hint, multiline, phone]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.hint}>{hint}</Text>
              <TextInput
                accessibilityLabel={`${label}, ${people[who].label}`}
                style={[styles.input, multiline && styles.multiline]}
                value={member(who)[key]}
                onChangeText={(v) => setMember(key, v)}
                multiline={multiline}
                keyboardType={phone ? 'phone-pad' : 'default'}
              />
            </View>
          ))}
          {who < people.length - 1 ? (
            <Tap accessibilityRole="button" onPress={() => setWho(who + 1)} style={styles.next}>
              <Text style={styles.nextText}>Next: {nameOf(who + 1)}</Text>
              <Icon name="chevronRight" size={18} color={colors.primary} />
            </Tap>
          ) : null}
        </View>
      ) : null}

      {GROUPS.filter(([title, keys]) => (title === 'Pets' ? hasPets : shown(keys).length > 0)).map(([title, keys]) => (
        <View key={title} style={styles.card}>
          <Text accessibilityRole="header" style={styles.groupTitle}>{titles[title] ?? title}</Text>
          {shown(keys).map((f) => (
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
    </KeyboardAvoidingView>
  );
}
