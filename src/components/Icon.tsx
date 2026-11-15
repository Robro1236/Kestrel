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
