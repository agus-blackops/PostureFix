import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '../theme';

export type IconName =
  | 'today'
  | 'chart'
  | 'flask'
  | 'gear'
  | 'flame'
  | 'stretch'
  | 'lock'
  | 'star'
  | 'check'
  | 'clock'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'person'
  | 'chevron'
  | 'gift';

/**
 * Iconos de trazo dibujados a mano en una cuadrícula de 24: se ven igual en
 * cualquier móvil, sin depender de las fuentes de símbolos de cada sistema.
 */
export function Icon({ name, size = 22, color, strokeWidth = 1.9 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const { colors } = useTheme();
  const common = {
    fill: 'none',
    stroke: color ?? colors.label,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'today' ? (
        <>
          <Path d="M4.5 16.5a8 8 0 1 1 15 0" {...common} />
          <Path d="M12 16.5l3.6-5.2" {...common} />
          <Circle cx={12} cy={16.5} r={1.4} {...common} />
        </>
      ) : null}
      {name === 'chart' ? <Path d="M5 20V11M10 20V5M15 20v-7M20 20V9" {...common} /> : null}
      {name === 'flask' ? (
        <>
          <Path d="M9 3h6M10 3v6L4.8 18.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9V3" {...common} />
          <Path d="M7.2 15h9.6" {...common} />
        </>
      ) : null}
      {name === 'gear' ? (
        <>
          <Circle cx={12} cy={12} r={3.2} {...common} />
          <Path
            d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"
            {...common}
          />
          <Circle cx={12} cy={12} r={6.6} {...common} />
        </>
      ) : null}
      {name === 'flame' ? (
        <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.9-7.9.4 1.7 1.3 2.9 2.4 3.4.2-2.8 1.4-5.2 3.6-7.3.4 3.3 3.1 5.6 3.1 10 0 4.2-2.6 8-6.5 8z" {...common} />
      ) : null}
      {name === 'stretch' ? (
        <>
          <Circle cx={12} cy={4.5} r={1.8} {...common} />
          <Path d="M5 8.5l7 1.5 7-1.5M12 10v5M12 15l-3.5 6M12 15l3.5 6" {...common} />
        </>
      ) : null}
      {name === 'lock' ? (
        <>
          <Rect x={5} y={10.5} width={14} height={10} rx={2.5} {...common} />
          <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...common} />
        </>
      ) : null}
      {name === 'star' ? (
        <Path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" {...common} />
      ) : null}
      {name === 'check' ? <Path d="M5 12.5l4.5 4.5L19 7.5" {...common} /> : null}
      {name === 'clock' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} {...common} />
          <Path d="M12 7.5V12l3 2" {...common} />
        </>
      ) : null}
      {name === 'bell' ? (
        <>
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" {...common} />
          <Path d="M10 20.5a2 2 0 0 0 4 0" {...common} />
        </>
      ) : null}
      {name === 'sun' ? (
        <>
          <Circle cx={12} cy={12} r={4} {...common} />
          <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...common} />
        </>
      ) : null}
      {name === 'moon' ? <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" {...common} /> : null}
      {name === 'person' ? (
        <>
          <Circle cx={12} cy={7} r={3.5} {...common} />
          <Path d="M5 20.5a7 7 0 0 1 14 0" {...common} />
        </>
      ) : null}
      {name === 'chevron' ? <Path d="M9 5.5l6.5 6.5L9 18.5" {...common} /> : null}
      {name === 'gift' ? (
        <>
          <Rect x={4} y={9} width={16} height={4} rx={1} {...common} />
          <Path d="M5.5 13v7.5h13V13M12 9v11.5M12 9C10 5 6.5 5.5 7.5 8.2 8 9 12 9 12 9zM12 9c2-4 5.5-3.5 4.5-.8C16 9 12 9 12 9z" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
