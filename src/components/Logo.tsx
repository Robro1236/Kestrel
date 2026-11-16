import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

// The app icon (assets/src/kestrel.svg) drawn live, so it stays sharp at any size. Keep the paths in step with that file.
// bare: just the bird in ink, no tile, to sit beside the "Kestrel" wordmark.
export function Logo({ size = 64, bare = false }: { size?: number; bare?: boolean }) {
  const line = bare ? colors.ink : colors.bg;
  return (
    // bare crops to the bird so it lines up with text instead of floating in the tile's padding.
    <Svg width={size} height={size} viewBox={bare ? '150 170 750 680' : '0 0 1024 1024'} pointerEvents="none" aria-hidden>
      {bare ? null : <Rect width="1024" height="1024" rx="230" fill={colors.primary} />}
      <G transform="translate(0 40)" fill="none" stroke={line} strokeWidth={bare ? 48 : 36} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M594 375 L340 150 C345 245 380 315 430 371" />
        <Path d="M560 460 L180 200 C190 340 300 470 520 555" />
        <Path d="M560 460 C585 370 630 300 700 295 C760 292 798 320 810 356" />
        <Path d="M810 356 C850 348 880 376 878 424 C862 408 836 402 806 404" />
        <Circle cx="740" cy="366" r={bare ? 26 : 20} fill={line} stroke="none" />
        <Path d="M806 404 C800 520 730 620 610 680" />
        <Path d="M520 555 C440 620 340 680 250 740" />
        <Path d="M250 740 L540 688" />
      </G>
    </Svg>
  );
}
