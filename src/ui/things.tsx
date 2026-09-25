import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { MOTION, rnSpring } from '../core/spring';
import { useReducedMotion, useSpringValue } from './expressive';
import { uiTap } from './glass';
import { colors, continuous, spacing, type } from './theme';

/**
 * Piezas de 1.1.3 con el carácter de Things: casillas que se marcan con un
 * pequeño golpe y un trazo, el «quesito» de progreso de los proyectos, títulos
 * de sección con su icono de color y un control segmentado cuya pastilla se
 * desliza. Mucho aire alrededor y el movimiento justo.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// --------------------------------------------------------------- casilla ---

/** Largo del trazo de la marca, para dibujarla con `strokeDashoffset`. */
const CHECK_LENGTH = 18;

/**
 * Casilla de Things: al marcarla se rellena, la marca se dibuja de izquierda a
 * derecha y la casilla da un pequeño salto. Sin `onToggle` es sólo indicador.
 */
export function CheckBox({
  checked,
  onToggle,
  color = colors.tint,
  size = 24,
  accessibilityLabel,
}: {
  checked: boolean;
  onToggle?: (next: boolean) => void;
  color?: string;
  size?: number;
  accessibilityLabel: string;
}) {
  const reduced = useReducedMotion();
  const fill = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (reduced || first.current) {
      first.current = false;
      fill.setValue(checked ? 1 : 0);
      return;
    }
    Animated.spring(fill, { toValue: checked ? 1 : 0, useNativeDriver: false, ...rnSpring(MOTION.effectsDefault) }).start();
    if (checked) {
      pop.setValue(0.78);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...rnSpring(MOTION.spatialFast) }).start();
    }
  }, [checked, fill, pop, reduced]);

  const box = (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x={1.5} y={1.5} width={21} height={21} rx={6.5} fill="none" stroke={colors.tertiaryLabel} strokeWidth={1.6} />
        <AnimatedRect x={1.5} y={1.5} width={21} height={21} rx={6.5} fill={color} opacity={fill} />
        <AnimatedPath
          d="M6.8 12.6 L10.4 16.1 L17.4 8.2"
          fill="none"
          stroke={colors.onTint}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
          strokeDashoffset={fill.interpolate({ inputRange: [0, 1], outputRange: [CHECK_LENGTH, 0], extrapolate: 'clamp' })}
        />
      </Svg>
    </Animated.View>
  );

  if (!onToggle) {
    return (
      <View accessible accessibilityRole="checkbox" accessibilityLabel={accessibilityLabel} accessibilityState={{ checked }}>
        {box}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        uiTap('selection');
        onToggle(!checked);
      }}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}>
      {box}
    </Pressable>
  );
}

// ---------------------------------------------------------------- quesito ---

/** Cuña que empieza arriba y avanza en el sentido de las agujas del reloj. */
function wedgePath(cx: number, cy: number, r: number, progress: number): string {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0.001) return '';
  if (p >= 0.999) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const angle = p * Math.PI * 2 - Math.PI / 2;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/** El progreso de un proyecto de Things: un aro fino y un quesito que se llena. */
export function PieProgress({ progress, size = 28, color = colors.tint }: { progress: number; size?: number; color?: string }) {
  const reduced = useReducedMotion();
  const shown = useSpringValue(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)), MOTION.spatialDefault, reduced);
  const c = size / 2;
  const stroke = Math.max(1.5, size / 16);
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={c} cy={c} r={c - stroke / 2} stroke={color} strokeWidth={stroke} fill="none" />
      <Path d={wedgePath(c, c, c - stroke * 2.2, shown)} fill={color} />
    </Svg>
  );
}

// ---------------------------------------------------------------- iconos ---

export type IconName = 'flask' | 'flame' | 'chart' | 'stretch' | 'lock' | 'star' | 'check';

/** Iconos de trazo, dibujados para no depender de las fuentes de cada sistema. */
export function Icon({ name, size = 20, color = colors.label }: { name: IconName; size?: number; color?: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'flask' ? (
        <>
          <Path d="M9 3h6M10 3v6L4.8 18.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9V3" {...common} />
          <Path d="M7.2 15h9.6" {...common} />
        </>
      ) : null}
      {name === 'flame' ? (
        <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.9-7.9.4 1.7 1.3 2.9 2.4 3.4.2-2.8 1.4-5.2 3.6-7.3.4 3.3 3.1 5.6 3.1 10 0 4.2-2.6 8-6.5 8z" {...common} />
      ) : null}
      {name === 'chart' ? (
        <>
          <Path d="M5 20V11M10 20V5M15 20v-7M20 20V9" {...common} />
        </>
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
    </Svg>
  );
}

// -------------------------------------------------------- título sección ---

/** Título de sección de Things: el icono en su color y el nombre en negrita. */
export function SectionTitle({
  icon,
  color,
  title,
  trailing,
}: {
  icon: IconName;
  color: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Icon name={icon} color={color} size={22} />
      <Text style={styles.sectionText} accessibilityRole="header">
        {title}
      </Text>
      {trailing}
    </View>
  );
}

// ----------------------------------------------------------- segmentado ---

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Control segmentado de iOS con la pastilla que se desliza con un muelle hasta
 * la opción elegida, en vez de saltar.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel: string;
}) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const segment = width > 0 ? (width - 4) / options.length : 0;
  const offset = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (segment === 0) return;
    const target = index * segment;
    if (reduced || !placed.current) {
      placed.current = true;
      offset.setValue(target);
      return;
    }
    Animated.spring(offset, { toValue: target, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start();
  }, [index, offset, reduced, segment]);

  return (
    <View
      style={styles.segmented}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {segment > 0 ? (
        <Animated.View style={[styles.segmentThumb, { width: segment, transform: [{ translateX: offset }] }]} />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            onPress={() => {
              if (selected) return;
              uiTap('selection');
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelOn]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionText: { ...type.title3, fontWeight: '700', color: colors.label, flex: 1 },

  segmented: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    backgroundColor: colors.tertiaryFill,
    ...continuous,
  },
  segmentThumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 8,
    backgroundColor: colors.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassHighlight,
    ...continuous,
  },
  segment: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  segmentLabel: { ...type.footnote, fontWeight: '500', color: colors.secondaryLabel },
  segmentLabelOn: { color: colors.label, fontWeight: '600' },
});

