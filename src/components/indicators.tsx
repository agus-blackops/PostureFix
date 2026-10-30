import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { LOADING_SEQUENCE, SHAPES, morphPath, wavyArcPath, type PolarShape, type ShapeName } from '../core/shapes';
import { MOTION, isSettled, rnSpring, stepSpring, type SpringState } from '../core/spring';
import { makeStyles, useTheme } from '../theme';
import { useReducedMotion, useRunningPhase, useSpringValue } from './motion';

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

const useStyles = makeStyles((t) => ({
  track: { width: '100%', backgroundColor: t.colors.tertiaryFill, overflow: 'hidden', justifyContent: 'center' },
  trackFill: { height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
}));

/** Barra en cápsula que se mueve con un muelle. */
export function ProgressBar({ progress, color, height = 8 }: { progress: number; color: string; height?: number }) {
  const styles = useStyles();
  const target = clamp01(progress);
  const value = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.spring(value, { toValue: target, useNativeDriver: false, ...rnSpring(MOTION.spatialDefault) }).start();
  }, [target, value]);
  const width = value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.trackFill, { width, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

/** Cuña que empieza arriba y avanza en el sentido de las agujas del reloj. */
function wedgePath(cx: number, cy: number, r: number, progress: number): string {
  const p = clamp01(progress);
  if (p <= 0.001) return '';
  if (p >= 0.999) return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  const angle = p * Math.PI * 2 - Math.PI / 2;
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${(cx + r * Math.cos(angle)).toFixed(2)} ${(
    cy +
    r * Math.sin(angle)
  ).toFixed(2)} Z`;
}

/** El «quesito» de los proyectos de Things. */
export function PieProgress({ progress, size = 28, color }: { progress: number; size?: number; color?: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const shown = useSpringValue(clamp01(progress), MOTION.spatialDefault, reduced);
  const c = size / 2;
  const stroke = Math.max(1.5, size / 16);
  const tint = color ?? theme.colors.tint;
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={c} cy={c} r={c - stroke / 2} stroke={tint} strokeWidth={stroke} fill="none" />
      <Path d={wedgePath(c, c, c - stroke * 2.2, shown)} fill={tint} />
    </Svg>
  );
}

/** Forma de Expressive que se transforma en otra con un muelle y, si se pide, gira. */
export function MorphShape({ shape, size, color, spin = 0 }: { shape: ShapeName | PolarShape; size: number; color: string; spin?: number }) {
  const reduced = useReducedMotion();
  const target = typeof shape === 'string' ? SHAPES[shape] : shape;
  const [from, setFrom] = useState<PolarShape>(target);
  const [to, setTo] = useState<PolarShape>(target);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (target.lobes === to.lobes && target.depth === to.depth) return;
    setFrom(to);
    setTo(target);
    setKey((k) => k + 1);
  }, [target, to]);

  const mix = useMorphProgress(key, reduced);
  const rotation = useRunningPhase(!reduced && spin > 0, spin * Math.PI * 2);
  const half = size / 2;
  return (
    <Svg width={size} height={size} pointerEvents="none">
      {/* Radio con margen: al rebotar, el muelle estira la forma un poco más. */}
      <Path d={morphPath(from, to, mix, half, half, half * 0.86, rotation)} fill={color} />
    </Svg>
  );
}

function useMorphProgress(key: number, reduced: boolean): number {
  const [value, setValue] = useState(1);
  useEffect(() => {
    if (key === 0 || reduced) {
      setValue(1);
      return undefined;
    }
    let state: SpringState = { value: 0, velocity: 0 };
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      state = stepSpring(state, 1, MOTION.spatialDefault, dt);
      if (isSettled(state, 1)) {
        setValue(1);
        return;
      }
      setValue(state.value);
      frame = requestAnimationFrame(tick);
    };
    setValue(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, reduced]);
  return value;
}

/** Indicador de carga de Expressive: una forma que se transforma en la siguiente. */
export function LoadingIndicator({ size = 48, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % LOADING_SEQUENCE.length), 650);
    return () => clearInterval(timer);
  }, []);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Cargando">
      <MorphShape shape={LOADING_SEQUENCE[index]} size={size} color={color ?? theme.colors.tint} spin={0.6} />
    </View>
  );
}

/**
 * Anillo con el indicador ondulado de Expressive: el tramo recorrido es una
 * onda que crece con la urgencia. La marca señala el umbral.
 */
export function WavyRing({
  size,
  stroke,
  progress,
  color,
  markAt,
  urgency,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  markAt?: number;
  urgency: number;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const maxAmplitude = stroke * 0.42;
  const shownProgress = useSpringValue(clamp01(progress), MOTION.spatialDefault, reduced);
  const amplitude = useSpringValue(clamp01(urgency) * maxAmplitude, MOTION.effectsSlow, reduced);
  const waving = !reduced && amplitude > 0.2;
  const phase = useRunningPhase(waving, 3 + urgency * 7);

  const center = size / 2;
  const r = center - stroke / 2 - maxAmplitude;
  const arc =
    shownProgress > 0.004
      ? wavyArcPath({ cx: center, cy: center, radius: r, progress: Math.min(shownProgress, 1), amplitude, wavelength: 34, phase })
      : '';

  let mark: ReactNode = null;
  if (markAt != null) {
    const angle = clamp01(markAt) * Math.PI * 2 - Math.PI / 2;
    const inner = r - stroke / 2 - 5;
    const outer = r + stroke / 2 + 5;
    mark = (
      <Line
        x1={center + inner * Math.cos(angle)}
        y1={center + inner * Math.sin(angle)}
        x2={center + outer * Math.cos(angle)}
        y2={center + outer * Math.sin(angle)}
        stroke={theme.colors.label}
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} stroke={theme.colors.tertiaryFill} strokeWidth={stroke} fill="none" />
        {arc ? <Path d={arc} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        {mark}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}
