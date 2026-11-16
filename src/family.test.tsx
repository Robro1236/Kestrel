import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Family, { cardHtml, EMPTY_PLAN, planText, type MemberPage } from '../app/family';
import { FamilyPlanLink } from './components/FamilyPlanLink';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const AsyncStorage = require('@react-native-async-storage/async-storage');

// protects=the family plan card keeps what was typed after a reload, and the shared text lists only filled fields; fails_when=edits aren't saved, a saved plan isn't loaded, or empty fields show up in the shared text; no_claim=printing on web or the native share sheet works
test('family: typed plan is saved, reloaded, and shared without empty fields', async () => {
  await render(<Family />);
  await fireEvent.changeText(screen.getByLabelText('Meeting place near home'), 'Mailbox at the corner');
  await fireEvent.changeText(screen.getByLabelText('Evacuation zone'), 'SJC-001');
  await waitFor(async () =>
    expect(JSON.parse(await AsyncStorage.getItem('familyPlan'))).toMatchObject({ nearHome: 'Mailbox at the corner', zone: 'SJC-001' }),
  );

  await screen.unmount();
  await render(<Family />);
  expect(await screen.findByDisplayValue('SJC-001')).toBeTruthy();

  const text = planText(JSON.parse(await AsyncStorage.getItem('familyPlan')));
  expect(text).toBe('Our family emergency plan\nMeeting place near home: Mailbox at the corner\nEvacuation zone: SJC-001');
});

// protects=the printed web card escapes typed text and keeps empty fields as blank lines; fails_when=typed HTML runs in the print frame, or an empty field is dropped from the paper card; no_claim=the browser's print dialog opens
test('family: print page escapes typed text and keeps blank fields', () => {
  const html = cardHtml({ ...EMPTY_PLAN, nearHome: '<img src=x onerror=alert(1)>', contacts: 'Mom 555\nDad 556', medical: 'Ana: peanut allergy' });
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<img');
  expect(html).toContain('Mom 555<br>Dad 556');
  expect(html).toContain('<dt>Evacuation zone</dt><dd></dd>');
  expect(html).toContain('<dt>Medical needs</dt><dd>Ana: peanut allergy</dd>');
  expect(html).toContain('<dt>Utility shutoffs</dt><dd></dd>');
  expect(html).toContain('Poison Help: 1-800-222-1222');
});

// protects=the plan screen's entry point opens the family plan card; fails_when=the link is missing its name or role, or goes anywhere but /family; no_claim=the link's position or look on the plan screen
test('FamilyPlanLink: opens the family plan card', async () => {
  await render(<FamilyPlanLink />);
  await fireEvent.press(screen.getByRole('link', { name: 'Family plan card' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/family');
});

// protects=the plan card fits the household: one pet photo slot per dog and cat, no Pets section without pets, and photos print under Pets; fails_when=slots don't match the household, a pet-free household gets a Pets section, or a non-JPEG URL reaches the print page; no_claim=the photo picker or resizer works on a device
test('family: pet photos follow the household and print under Pets', async () => {
  const { petSlots } = require('../app/family');
  expect(petSlots({ dogs: 2, cats: 1 })).toEqual(['Dog', 'Dog 2', 'Cat']);
  expect(petSlots({ dogs: 0, cats: 0, otherPets: 2 })).toEqual(['Pet', 'Pet 2']);
  expect(petSlots(null)).toEqual([]);

  // No household saved yet: the general card, pets included.
  await render(<Family />);
  expect(await screen.findByLabelText('Add a photo of pet')).toBeTruthy();
  await screen.unmount();

  // A household without pets: no pet fields, just a way to add pets.
  await AsyncStorage.setItem('household', JSON.stringify({ adults: 2, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false }));
  await render(<Family />);
  expect(await screen.findByText('Add pets')).toBeTruthy();
  expect(screen.queryByLabelText('Pet details')).toBeNull();
  await screen.unmount();

  await AsyncStorage.setItem('household', JSON.stringify({ dogs: 1, cats: 1 }));
  await render(<Family />);
  expect(await screen.findByLabelText('Add a photo of dog')).toBeTruthy();
  expect(screen.getByLabelText('Add a photo of cat')).toBeTruthy();

  const jpeg = 'data:image/jpeg;base64,AAAA';
  const html = cardHtml(EMPTY_PLAN, { photos: [jpeg, 'javascript:alert(1)'] });
  expect(html).toContain(`<dt>Pet details</dt><dd></dd><dd class="photos"><img src="${jpeg}" alt=""></dd>`);
  expect(html).not.toContain('javascript:');
  expect(cardHtml(EMPTY_PLAN, { pets: false })).not.toContain('<dt>Pet details</dt>');
});

// protects=the card's header, section titles and hints follow the household; fails_when=a household without kids still asks about schools, a medicine or mobility need isn't prompted, or the summary miscounts; no_claim=the hints are complete medical advice
test('family: card is tailored to the household', async () => {
  const { householdSummary, tailor } = require('../app/family');
  const h = { adults: 2, seniors: 0, children: 0, infants: 1, dogs: 1, cats: 0, medication: true, mobility: false };
  expect(householdSummary(h)).toBe('2 adults, 1 infant, 1 dog');
  const t = tailor(h);
  expect(t.titles['School and work']).toBeUndefined();
  expect(t.hints.contacts).toContain('each of the 3 people');
  expect(t.hints.medical).toContain('daily medicine');
  expect(t.hints.medical).toContain("baby's formula");
  expect(t.hints.medical).not.toContain('help to get around');
  expect(tailor({ ...h, infants: 0 }).titles['School and work']).toBe('Work');
  expect(tailor(null)).toEqual({ titles: {}, hints: {} });

  await AsyncStorage.setItem('household', JSON.stringify(h));
  await render(<Family />);
  expect(await screen.findByText('Made for your household: 2 adults, 1 infant, 1 dog.')).toBeTruthy();
  expect(screen.getByText('School and work')).toBeTruthy();
});

// protects=each person gets their own page, Next moves to the next person, and Print puts every person on one card; fails_when=pages don't follow the household, one person's answers show on another's page, or a person is missing from the print or share text; no_claim=the print dialog itself
test('family: one page per person, printed together', async () => {
  const { memberSlots } = require('../app/family');
  expect(memberSlots({ adults: 2, seniors: 0, children: 1, infants: 0 }).map((m: { label: string }) => m.label)).toEqual(['Adult', 'Adult 2', 'Child']);
  expect(memberSlots(null)).toEqual([]);

  await AsyncStorage.setItem('household', JSON.stringify({ adults: 2, seniors: 0, children: 1, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false }));
  await render(<Family />);
  await fireEvent.changeText(await screen.findByLabelText('Name, Adult'), 'Dad');
  await fireEvent.changeText(screen.getByLabelText('Medical needs, Adult'), 'Insulin');
  await fireEvent.press(screen.getByRole('button', { name: 'Next: Adult 2' }));
  expect(screen.getByLabelText('Name, Adult 2').props.value).toBe('');
  await fireEvent.press(screen.getByRole('tab', { name: 'Child' }));
  expect(screen.getByText('School')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('School, Child'), 'Lincoln Elementary');
  await waitFor(async () => expect(JSON.parse(await AsyncStorage.getItem('familyMembers'))[2]).toMatchObject({ school: 'Lincoln Elementary' }));
  expect(JSON.parse(await AsyncStorage.getItem('familyMembers'))[0]).toMatchObject({ name: 'Dad', medical: 'Insulin' });

  const pages: MemberPage[] = [{ name: 'Dad', rows: [['Medical needs', 'Insulin'], ['School and work', '']] }, { name: 'Child', rows: [['Medical needs', ''], ['School', 'Lincoln Elementary']] }];
  const html = cardHtml(EMPTY_PLAN, { members: pages });
  expect(html).toContain('<h2>Dad</h2><dl><dt>Medical needs</dt><dd>Insulin</dd>');
  expect(html).toContain('<h2>Child</h2>');
  expect(html).not.toContain('<dt>School, childcare and work</dt>');
  expect(planText(EMPTY_PLAN, pages)).toBe('Our family emergency plan\nDad, medical needs: Insulin\nChild, school: Lincoln Elementary');
});

// protects=each person's page holds their own phone, doctors and health insurance, the shared Health card and phone list go away, and home insurance stays shared; fails_when=a person's phone or insurance is saved to the wrong person, the shared Health card still shows empty, or the print misses the new rows; no_claim=the phone keyboard on a device
test('family: phone, doctors and health insurance on each person', async () => {
  await AsyncStorage.setItem('household', JSON.stringify({ adults: 2, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false }));
  await render(<Family />);
  await fireEvent.changeText(await screen.findByLabelText('Phone, Adult'), '555-0101');
  await fireEvent.changeText(screen.getByLabelText('Doctors and pharmacy, Adult'), 'Dr. Lee 555-0102');
  await fireEvent.changeText(screen.getByLabelText('Health insurance, Adult'), 'Kaiser 123');
  await waitFor(async () => expect(JSON.parse(await AsyncStorage.getItem('familyMembers'))[0]).toMatchObject({ phone: '555-0101', doctors: 'Dr. Lee 555-0102', insurance: 'Kaiser 123' }));
  expect(screen.queryByText('Health')).toBeNull();
  expect(screen.queryByLabelText('Household phones')).toBeNull();
  expect(screen.getByLabelText('Home or renters insurance')).toBeTruthy();

  const html = cardHtml(EMPTY_PLAN, { members: [{ name: 'Mom', rows: [['Phone', '555-0101'], ['Health insurance', 'Kaiser 123']] }] });
  expect(html).toContain('<h2>Mom</h2><dl><dt>Phone</dt><dd>555-0101</dd><dt>Health insurance</dt><dd>Kaiser 123</dd>');
  expect(html).toContain('<dt>Home or renters insurance</dt>');
  expect(html).not.toContain('<dt>Household phones</dt>');
  expect(cardHtml(EMPTY_PLAN)).not.toContain('Home or renters insurance');
});

// protects=an infant's page has no phone field and the printed card has no Phone row for them; fails_when=a baby is asked for their cell phone; no_claim=older children have phones
test('family: no phone on an infant page', async () => {
  await AsyncStorage.setItem('household', JSON.stringify({ adults: 1, seniors: 0, children: 0, infants: 1, dogs: 0, cats: 0, medication: false, mobility: false }));
  await render(<Family />);
  expect(await screen.findByLabelText('Phone, Adult')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Infant' }));
  expect(screen.queryByLabelText('Phone, Infant')).toBeNull();
  expect(screen.getByLabelText('Childcare, Infant')).toBeTruthy();
});

// protects=Email the card opens the mail app with the plan and key numbers, and leaves the recipient to the person; fails_when=the button is missing, the body drops the plan or key numbers, or a recipient is filled in; no_claim=a mail app is installed
test('family: email the card', async () => {
  const { Linking } = require('react-native');
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<Family />);
  await fireEvent.changeText(screen.getByLabelText('Meeting place near home'), 'Corner mailbox');
  await fireEvent.press(screen.getByRole('button', { name: 'Email the card' }));
  const url = decodeURIComponent(open.mock.calls[0][0] as string);
  expect(url.startsWith('mailto:?subject=Our family emergency plan&body=')).toBe(true);
  expect(url).toContain('Meeting place near home: Corner mailbox');
  expect(url).toContain('911');
});

// protects=on a phone browser, Email the card attaches the printable card as a file; fails_when=only text is sent or the file isn't the card; no_claim=which apps the share sheet lists
test('family: email attaches the card on the web', async () => {
  const { Platform } = require('react-native');
  const os = Platform.OS;
  const share = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { canShare: () => true, share });
  try {
    Platform.OS = 'web';
    await render(<Family />);
    await fireEvent.changeText(screen.getByLabelText('Meeting place near home'), 'Corner mailbox');
    await fireEvent.press(screen.getByRole('button', { name: 'Email the card' }));
  } finally {
    Platform.OS = os;
  }
  const { files, text } = share.mock.calls[0][0];
  expect(files[0].name).toBe('family-emergency-plan.html');
  expect(await files[0].text()).toContain('Corner mailbox');
  expect(text).toContain('911');
});

// protects=each person's page has its own photo slot, and the printed card shows that person's photo under their name without changing the rows; fails_when=the slot is missing, a photo shows on someone else's page, a non-JPEG URL is printed, or a page without a photo changes; no_claim=the photo picker on a device
test('family: a photo for each person', async () => {
  const jpeg = 'data:image/jpeg;base64,AAAA';
  await AsyncStorage.setItem('household', JSON.stringify({ adults: 2, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false }));
  await AsyncStorage.setItem('familyMembers', JSON.stringify([{ name: 'Mom', photo: jpeg }]));
  await render(<Family />);
  expect(await screen.findByLabelText('Photo, Adult')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Adult 2' }));
  expect(screen.getByLabelText('Add a photo, Adult 2')).toBeTruthy();
  expect(screen.queryByLabelText('Photo, Adult 2')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Mom' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove photo, Adult' }));
  await waitFor(async () => expect(JSON.parse(await AsyncStorage.getItem('familyMembers'))[0].photo).toBe(''));

  const html = cardHtml(EMPTY_PLAN, { members: [{ name: 'Mom', rows: [['Phone', '555']], photo: jpeg }, { name: 'Kid', rows: [['Phone', '']], photo: 'javascript:alert(1)' }] });
  expect(html).toContain(`<h2>Mom</h2><div class="photos"><img src="${jpeg}" alt=""></div><dl><dt>Phone</dt>`);
  expect(html).toContain('<h2>Kid</h2><dl>');
  expect(html).not.toContain('javascript:');
});
