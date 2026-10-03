import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, type StyleProp, type ViewStyle } from 'react-native';

import { MOTION, isSettled, rnSpring, stepSpring, type SpringSpec, type SpringState } from '../core/spring';

/**
 * Movimiento de la 2.0: muelles de Material 3 Expressive (src/core/spring.ts)
 * y nada que se mueva si el sistema pide reducir el movimiento.
 */

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduced(value))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Un número que persigue a `target` con un muelle: para lo que se dibuja en SVG. */
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
export function useRunningPhase(active: boolean, speed: number): number {
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

/** Entrada escalonada: sube un poco y aparece con el muelle espacial lento. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.spring(progress, { toValue: 1, delay: index * 60, useNativeDriver: true, ...rnSpring(MOTION.spatialSlow) }).start();
  }, [index, progress, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** Un rebote corto cada vez que cambia `trigger`. */
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
