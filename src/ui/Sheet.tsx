import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOTION, rnSpring } from '../core/spring';
import { useReducedMotion } from './expressive';
import { Button, GlassSurface } from './glass';
import { colors, radius, spacing, type } from './theme';

/** Arrastre a partir del cual soltar la hoja la cierra. */
const DISMISS_DISTANCE = 120;
/** O una velocidad hacia abajo de este tanto (px/ms), aunque el arrastre sea corto. */
const DISMISS_VELOCITY = 1.1;

/**
 * Hoja de cristal que sube con un muelle en vez de con la animación fija del
 * sistema, se oscurece el fondo a la vez y se cierra arrastrándola por el asa
 * o por la cabecera. Al cerrarse baja con el mismo muelle antes de desmontarse.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  scroll = true,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `false` para contenido que se organiza solo (el reproductor de estiramientos). */
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      const open = reduced
        ? Animated.timing(progress, { toValue: 1, duration: 160, useNativeDriver: true })
        : Animated.spring(progress, { toValue: 1, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) });
      open.start();
      return undefined;
    }
    const close = reduced
      ? Animated.timing(progress, { toValue: 0, duration: 140, useNativeDriver: true })
      : // Al bajar no rebota: un muelle crítico, rápido y sin pasarse.
        Animated.spring(progress, {
          toValue: 0,
          useNativeDriver: true,
          ...rnSpring(MOTION.effectsFast),
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        });
    close.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return undefined;
  }, [drag, progress, reduced, visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => drag.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
          onCloseRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start(),
    })
  ).current;

  if (!mounted) return null;

  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
    drag
  );

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fixed, { paddingBottom: spacing.xl + insets.bottom }]}>{children}</View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={`Cerrar ${title.toLowerCase()}`} />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
          <GlassSurface material="thick" cornerRadius={radius.extraLarge} style={styles.sheet}>
            <View {...pan.panHandlers}>
              <View style={styles.grabberArea}>
                <View style={styles.grabber} />
              </View>
              <View style={styles.header}>
                <View style={styles.headerSide} />
                <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
                  {title}
                </Text>
                <View style={[styles.headerSide, styles.headerRight]}>
                  <Button label="Listo" onPress={onClose} variant="plain" size="small" accessibilityLabel={`Cerrar ${title.toLowerCase()}`} />
                </View>
              </View>
            </View>
            {body}
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { maxHeight: '92%' },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, flexShrink: 1 },
  grabberArea: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.tertiaryLabel },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    minHeight: 44,
  },
  headerSide: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  title: { ...type.headline, color: colors.label },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xxl, paddingTop: spacing.sm },
  fixed: { flexShrink: 1 },
});
