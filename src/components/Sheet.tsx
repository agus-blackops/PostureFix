import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOTION, rnSpring } from '../core/spring';
import { makeStyles, radius, spacing, type } from '../theme';
import { Button } from './controls';
import { useReducedMotion } from './motion';
import { GlassSurface } from './Surface';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1.1;

const useStyles = makeStyles((t) => ({
  scrim: { backgroundColor: t.colors.scrim },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { maxHeight: '94%' },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, flexShrink: 1 },
  grabberArea: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: t.colors.tertiaryLabel },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, minHeight: 44 },
  headerSide: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  title: { ...type.headline, color: t.colors.label },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl, paddingTop: spacing.sm },
}));

/**
 * Hoja de cristal que sube con un muelle, oscurece el fondo a la vez y se
 * cierra arrastrándola por el asa o por la cabecera.
 */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const styles = useStyles();
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
      (reduced
        ? Animated.timing(progress, { toValue: 1, duration: 160, useNativeDriver: true })
        : Animated.spring(progress, { toValue: 1, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) })
      ).start();
      return;
    }
    // Al bajar no rebota: un muelle crítico, rápido y sin pasarse.
    (reduced
      ? Animated.timing(progress, { toValue: 0, duration: 140, useNativeDriver: true })
      : Animated.spring(progress, {
          toValue: 0,
          useNativeDriver: true,
          ...rnSpring(MOTION.effectsFast),
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        })
    ).start(({ finished }) => finished && setMounted(false));
  }, [drag, progress, reduced, visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) onCloseRef.current();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start(),
    })
  ).current;

  if (!mounted) return null;

  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag);
  const closeLabel = `Cerrar ${title.toLowerCase()}`;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />
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
                  <Button label="Listo" onPress={onClose} variant="plain" size="small" accessibilityLabel={closeLabel} />
                </View>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}
