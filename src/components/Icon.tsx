import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';

// One icon set, drawn on a 24px grid with round 2px strokes, so every icon is centred and the same weight.
// Never use text glyphs (× › ✓ ▸) as icons: fonts place them off-centre and differently per platform.
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  plus: 'M12 5.5v13M5.5 12h13',
  minus: 'M5.5 12h13',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronDown: 'M6 9.5l6 6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v5.5M12 7.6v.1',
  expand: 'M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5',
  closeCircle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9 9l6 6M15 9l-6 6',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
  drop: 'M12 3.5c3.5 4.5 6 7.6 6 10.5a6 6 0 0 1-12 0c0-2.9 2.5-6 6-10.5z',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  people: 'M9 4a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3 3 0 0 1 0 6M18 14c2 .6 3 2.8 3 6',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  phone: 'M7 3h10v18H7zM11 18h2',
};

export type IconName = keyof typeof PATHS;

// Decorative: the button around it carries the accessible label.
export function Icon({ name, size = 20, color = colors.ink, weight = 2 }: { name: IconName; size?: number; color?: string; weight?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none" aria-hidden>
      <Path d={PATHS[name]} stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
