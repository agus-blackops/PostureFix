import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import {
  LOADING_SEQUENCE,
  SHAPES,
  morphPath,
  wavyArcPath,
  type PolarShape,
  type ShapeName,
} from '../core/shapes';
import { MOTION, isSettled, rnSpring, stepSpring, type SpringSpec, type SpringState } from '../core/spring';
import { colors } from './theme';

/**
 * Movimiento y formas de Material 3 Expressive sobre el cristal de la app:
 * muelles con la física de la especificación (src/core/spring.ts), un anillo
 * cuya onda dice cuánto urge enderezarse y formas que se transforman unas en
 * otras. Todo se para si el sistema pide reducir el movimiento.
 */

// ----------------------------------------------------------- utilidades ---

/** `true` si el usuario ha pedido reducir el movimiento en el sistema. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/**
 * Valor que persigue a `target` con un muelle, fotograma a fotograma. Para lo
 * que se dibuja a mano (trazados SVG), donde `Animated` no llega.
 */
export function useSpringValue(target: number, spec: SpringSpec, immediate = false): number {
  const [value, setValue] = useState(target);
  const state = useRef<SpringState>({ value: target, velocity: 0 });

  useEffect(() => {
    if (immediate) {
      state.current = { value: target, velocity: 0 };
      setValue(target);
      return undefined;
    }
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      state.current = stepSpring(state.current, target, spec, dt);
      if (isSettled(state.current, target)) {
        state.current = { value: target, velocity: 0 };
        setValue(target);
        return;
      }
      setValue(state.current.value);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [immediate, spec, target]);

  return value;
}

/** Ángulo que avanza a `speed` radianes por segundo mientras `active`. */
function useRunningPhase(active: boolean, speed: number): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      if (last != null) {
        const dt = Math.min((now - last) / 1000, 0.1);
        setPhase((current) => (current + speed * dt) % (Math.PI * 2000));
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, speed]);
  return phase;
}

// ------------------------------------------------------------- entrada ---

/**
 * Entrada con el muelle espacial lento: sube un poco y aparece. `index`
 * escalona las tarjetas para que lleguen una detrás de otra.
 */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.spring(progress, {
      toValue: 1,
      delay: index * 70,
      useNativeDriver: true,
      ...rnSpring(MOTION.spatialSlow),
    }).start();
  }, [index, progress, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** Un pequeño rebote cada vez que cambia `trigger` (p. ej. el estado). */
export function Pop({ trigger, children, style }: { trigger: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.setValue(0.86);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...rnSpring(MOTION.spatialFast) }).start();
  }, [reduced, scale, trigger]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

// -------------------------------------------------------------- formas ---

/**
 * Forma de Material 3 Expressive que se transforma en otra con un muelle
 * espacial (se pasa un poco y vuelve) y, si se pide, gira despacio.
 */
export function MorphShape({
  shape,
  size,
  color,
  spin = 0,
}: {
  shape: ShapeName | PolarShape;
  size: number;
  color: string;
  /** Vueltas por segundo; 0 = quieta. */
  spin?: number;
}) {
  const reduced = useReducedMotion();
  const target = typeof shape === 'string' ? SHAPES[shape] : shape;
  const [from, setFrom] = useState<PolarShape>(target);
  const [to, setTo] = useState<PolarShape>(target);
  const [key, setKey] = useState(0);

  // Al cambiar de forma, la de antes pasa a ser el punto de partida.
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
      {/* Radio con margen: al rebotar, el muelle estira la forma más allá de su tamaño. */}
      <Path d={morphPath(from, to, mix, half, half, half * 0.86, rotation)} fill={color} />
    </Svg>
  );
}

/** Va de 0 a 1 con un muelle espacial cada vez que cambia `key`. */
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

/**
 * Indicador de carga de Material 3 Expressive: una forma que va
 * transformándose en la siguiente de la secuencia mientras gira.
 */
export function LoadingIndicator({ size = 48, color = colors.tint }: { size?: number; color?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % LOADING_SEQUENCE.length), 650);
    return () => clearInterval(timer);
  }, []);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Cargando">
      <MorphShape shape={LOADING_SEQUENCE[index]} size={size} color={color} spin={0.6} />
    </View>
  );
}

// -------------------------------------------------------------- anillo ---

/**
 * Anillo del medidor con el indicador ondulado de Material 3 Expressive. El
 * tramo recorrido es una onda que corre alrededor: plana con la postura bien,
 * suave al agacharte y fuerte en la alarma. La pista queda lisa y la marca
 * blanca señala el umbral.
 */
export function WavyRing({
  size,
  stroke,
  progress,
  color,
  trackColor,
  markAt,
  urgency,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  trackColor: string;
  markAt?: number;
  /** 0 = calma (arco liso), 1 = alarma (onda fuerte y rápida). */
  urgency: number;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const maxAmplitude = stroke * 0.42;
  const clampedProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const shownProgress = useSpringValue(clampedProgress, MOTION.spatialDefault, reduced);
  const amplitude = useSpringValue(Math.min(1, Math.max(0, urgency)) * maxAmplitude, MOTION.effectsSlow, reduced);
  const waving = !reduced && amplitude > 0.2;
  const phase = useRunningPhase(waving, 3 + urgency * 7);

  const center = size / 2;
  const radius = center - stroke / 2 - maxAmplitude;
  const arc =
    shownProgress > 0.004
      ? wavyArcPath({ cx: center, cy: center, radius, progress: Math.min(shownProgress, 1), amplitude, wavelength: 34, phase })
      : '';

  let mark: ReactNode = null;
  if (markAt != null) {
    const angle = Math.min(1, Math.max(0, markAt)) * Math.PI * 2 - Math.PI / 2;
    const inner = radius - stroke / 2 - 5;
    const outer = radius + stroke / 2 + 5;
    mark = (
      <Line
        x1={center + inner * Math.cos(angle)}
        y1={center + inner * Math.sin(angle)}
        x2={center + outer * Math.cos(angle)}
        y2={center + outer * Math.sin(angle)}
        stroke={colors.label}
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {arc ? (
          <Path d={arc} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : null}
        {mark}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
