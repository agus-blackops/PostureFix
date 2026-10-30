import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Switch, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { MOTION, rnSpring } from '../core/spring';
import { uiFeedback, type UiFeedback } from '../services/haptics';
import { continuous, makeStyles, radius, shadowFor, spacing, type, useTheme } from '../theme';
import { GlassFill, GlassSurface } from './Surface';
import { useReducedMotion } from './motion';

let hapticsEnabled = true;

/** Los toques suaves de la interfaz tienen su propio ajuste. */
export function setUiHaptics(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function tap(kind: UiFeedback): void {
  uiFeedback(kind, hapticsEnabled);
}

const useStyles = makeStyles((t) => ({
  disabled: { opacity: 0.4 },
  stretch: { flex: 1 },
  buttonBody: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
    gap: spacing.sm,
    ...continuous,
  },
  buttonBodySmall: { paddingHorizontal: spacing.lg },
  glassEdge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.glassEdge,
    borderTopColor: t.colors.glassHighlight,
  },
  label: { ...type.headline, textAlign: 'center' },
  labelSmall: { ...type.subheadline, fontWeight: '600', textAlign: 'center' },

  group: { flexDirection: 'row', gap: 3 },
  groupItem: { paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  segmented: { flexDirection: 'row', padding: 2, borderRadius: 10, backgroundColor: t.colors.tertiaryFill, ...continuous },
  segmentThumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 8,
    backgroundColor: t.dark ? t.colors.fill : '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.glassHighlight,
    ...shadowFor(t, 'tiny'),
    ...continuous,
  },
  segment: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  segmentLabel: { ...type.footnote, fontWeight: '500', color: t.colors.secondaryLabel },
  segmentLabelOn: { color: t.colors.label, fontWeight: '600' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 9,
    backgroundColor: t.colors.tertiaryFill,
    overflow: 'hidden',
    ...continuous,
  },
  stepperHalf: { width: 46, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepperPressed: { backgroundColor: t.colors.fill },
  stepperGlyph: { fontSize: 22, lineHeight: 24, color: t.colors.label, fontWeight: '500' },
  stepperGlyphOff: { color: t.colors.quaternaryLabel },
  stepperDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: t.colors.separator },

  chips: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  chip: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.tertiaryFill,
  },
  chipOn: { backgroundColor: t.colors.tint },
  chipLabel: { ...type.subheadline, fontWeight: '600', color: t.colors.secondaryLabel },
  chipLabelOn: { color: t.colors.onTint },
}));

// --------------------------------------------------------------- botones ---

/** Encogerse un poco al pulsar y volver con un rebote corto. */
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    pressIn: () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, ...rnSpring(MOTION.spatialFast) }).start(),
    pressOut: () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start(),
  };
}

/** Forma de Material 3 Expressive: se cuadra al pulsar y cambia al seleccionarse. */
function useShapeMorph(height: number, selected: boolean) {
  const press = useRef(new Animated.Value(0)).current;
  const rest = useRef(new Animated.Value(selected ? height * 0.3 : height / 2)).current;

  useEffect(() => {
    Animated.spring(rest, { toValue: selected ? height * 0.3 : height / 2, useNativeDriver: false, ...rnSpring(MOTION.spatialDefault) }).start();
  }, [height, rest, selected]);

  const cornerRadius = Animated.subtract(rest, Animated.multiply(press, height * 0.18)).interpolate({
    inputRange: [0, height],
    outputRange: [0, height],
    extrapolate: 'clamp',
  });

  return {
    cornerRadius,
    pressIn: () => Animated.spring(press, { toValue: 1, useNativeDriver: false, ...rnSpring(MOTION.spatialFast) }).start(),
    pressOut: () => Animated.spring(press, { toValue: 0, useNativeDriver: false, ...rnSpring(MOTION.spatialDefault) }).start(),
  };
}

const HEIGHT = { large: 56, regular: 48, small: 34 } as const;

export function Button({
  label,
  onPress,
  variant = 'glass',
  size = 'regular',
  color,
  onColor,
  icon,
  disabled = false,
  selected = false,
  stretch = false,
  haptic = 'light',
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  /** `prominent`: acción principal rellena; `glass`: secundaria; `plain`: texto. */
  variant?: 'prominent' | 'glass' | 'plain';
  size?: keyof typeof HEIGHT;
  color?: string;
  onColor?: string;
  icon?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
  stretch?: boolean;
  haptic?: UiFeedback;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { scale, pressIn, pressOut } = usePressScale();
  const height = HEIGHT[size];
  const shape = useShapeMorph(height, selected);
  const fill = color ?? theme.colors.tint;
  const textColor =
    variant === 'prominent' ? (onColor ?? theme.colors.onTint) : (color ?? (variant === 'plain' ? theme.colors.tintText : theme.colors.label));

  return (
    <Animated.View
      style={[
        stretch && styles.stretch,
        { transform: [{ scale }] },
        variant === 'prominent' && size === 'large' && !disabled && shadowFor(theme, 'button', fill),
        disabled && styles.disabled,
      ]}>
      <Pressable
        onPress={() => {
          tap(haptic);
          onPress();
        }}
        onPressIn={() => {
          pressIn();
          shape.pressIn();
        }}
        onPressOut={() => {
          pressOut();
          shape.pressOut();
        }}
        disabled={disabled}
        hitSlop={size === 'small' ? 6 : 0}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, selected }}>
        <Animated.View
          style={[
            styles.buttonBody,
            { minHeight: height, borderRadius: shape.cornerRadius },
            size === 'small' && styles.buttonBodySmall,
            variant === 'prominent' && { backgroundColor: fill },
            variant === 'glass' && styles.glassEdge,
          ]}>
          {variant === 'glass' ? <GlassFill /> : null}
          {icon}
          <Text style={[size === 'small' ? styles.labelSmall : styles.label, { color: textColor }]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export interface GroupItem {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}

/** Grupo conectado de Expressive: el que se pulsa se ensancha y redondea por dentro. */
export function ButtonGroup({ items }: { items: GroupItem[] }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      {items.map((item, index) => (
        <GroupButton key={item.label} item={item} first={index === 0} last={index === items.length - 1} />
      ))}
    </View>
  );
}

function GroupButton({ item, first, last }: { item: GroupItem; first: boolean; last: boolean }) {
  const theme = useTheme();
  const styles = useStyles();
  const height = HEIGHT.regular;
  const press = useRef(new Animated.Value(0)).current;
  const animate = (toValue: number, token: 'spatialFast' | 'spatialDefault') =>
    Animated.spring(press, { toValue, useNativeDriver: false, ...rnSpring(MOTION[token]) }).start();
  const outer = height / 2;
  const inner = press.interpolate({ inputRange: [0, 1], outputRange: [8, height * 0.36] });
  const grow = press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <Animated.View style={{ flexGrow: grow, flexShrink: 1, flexBasis: 0 }}>
      <Pressable
        onPress={() => {
          tap('light');
          item.onPress();
        }}
        onPressIn={() => animate(1, 'spatialFast')}
        onPressOut={() => animate(0, 'spatialDefault')}
        disabled={item.disabled}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityHint={item.accessibilityHint}
        accessibilityState={{ disabled: !!item.disabled }}>
        <Animated.View
          style={[
            styles.groupItem,
            styles.glassEdge,
            {
              minHeight: height,
              borderTopLeftRadius: first ? outer : inner,
              borderBottomLeftRadius: first ? outer : inner,
              borderTopRightRadius: last ? outer : inner,
              borderBottomRightRadius: last ? outer : inner,
            },
            item.disabled && styles.disabled,
          ]}>
          <GlassFill />
          <Text style={[styles.label, { color: theme.colors.label }]} numberOfLines={1}>
            {item.label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Botón redondo de cristal de 44 pt. */
export function IconButton({ icon, onPress, accessibilityLabel }: { icon: ReactNode; onPress: () => void; accessibilityLabel: string }) {
  const styles = useStyles();
  const { scale, pressIn, pressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          tap('light');
          onPress();
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}>
        <GlassSurface material="thin" cornerRadius={radius.capsule} interactive style={styles.iconButton}>
          {/* En la web el SVG suelto quedaría debajo del desenfoque, que va posicionado. */}
          <View>{icon}</View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

// ------------------------------------------------------------ selección ---

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Control segmentado cuya pastilla se desliza con un muelle hasta la opción elegida. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
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
      style={[styles.segmented, disabled && styles.disabled]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {segment > 0 ? <Animated.View style={[styles.segmentThumb, { width: segment, transform: [{ translateX: offset }] }]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            disabled={disabled}
            onPress={() => {
              if (selected) return;
              tap('selection');
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelOn]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Interruptor de iOS con el acento de la app. */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        tap('selection');
        onValueChange(next);
      }}
      trackColor={{ false: colors.fill, true: colors.tint }}
      thumbColor="#FFFFFF"
      // react-native-web pinta el botón encendido con su propio color si no se le dice.
      {...({ activeThumbColor: '#FFFFFF' } as object)}
      ios_backgroundColor={colors.fill}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

/** «Stepper» de iOS: cada mitad se apaga al llegar a su límite. */
export function Stepper({
  label,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
}: {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
}) {
  const styles = useStyles();
  const half = (glyph: string, enabled: boolean, action: () => void, a11y: string) => (
    <Pressable
      disabled={!enabled}
      onPress={() => {
        tap('selection');
        action();
      }}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [styles.stepperHalf, pressed && styles.stepperPressed]}>
      <Text style={[styles.stepperGlyph, !enabled && styles.stepperGlyphOff]}>{glyph}</Text>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {half('−', canDecrease, onDecrease, `Bajar ${label}`)}
      <View style={styles.stepperDivider} />
      {half('+', canIncrease, onIncrease, `Subir ${label}`)}
    </View>
  );
}

/** Días de la semana como botones que se encienden y se apagan. */
export function DayChips({ labels, values, onToggle }: { labels: readonly string[]; values: boolean[]; onToggle: (index: number) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.chips}>
      {labels.map((label, index) => (
        <Pressable
          key={label + index}
          onPress={() => {
            tap('selection');
            onToggle(index);
          }}
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{ checked: values[index] }}
          style={[styles.chip, values[index] && styles.chipOn]}>
          <Text style={[styles.chipLabel, values[index] && styles.chipLabelOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// --------------------------------------------------------------- casilla ---

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const CHECK_LENGTH = 18;

/**
 * Casilla al estilo de Things: se rellena, la marca se dibuja de izquierda a
 * derecha y la casilla da un saltito. Sin `onToggle` sólo indica.
 */
export function CheckBox({
  checked,
  onToggle,
  color,
  size = 24,
  accessibilityLabel,
}: {
  checked: boolean;
  onToggle?: (next: boolean) => void;
  color?: string;
  size?: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
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
        <Rect x={1.5} y={1.5} width={21} height={21} rx={6.5} fill="none" stroke={theme.colors.tertiaryLabel} strokeWidth={1.6} />
        <AnimatedRect x={1.5} y={1.5} width={21} height={21} rx={6.5} fill={color ?? theme.colors.tint} opacity={fill} />
        <AnimatedPath
          d="M6.8 12.6 L10.4 16.1 L17.4 8.2"
          fill="none"
          stroke={theme.dark ? theme.colors.onTint : '#FFFFFF'}
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
        tap('selection');
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
