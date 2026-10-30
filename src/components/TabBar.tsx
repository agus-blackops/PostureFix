import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOTION, rnSpring } from '../core/spring';
import { continuous, makeStyles, radius, shadowFor, spacing, type, useTheme, withAlpha } from '../theme';
import { tap } from './controls';
import { Icon, type IconName } from './Icon';
import { useReducedMotion } from './motion';
import { GlassSurface } from './Surface';

export interface Tab<T extends string> {
  key: T;
  label: string;
  icon: IconName;
  /** Un punto naranja sobre el icono (p. ej. Labs con la prueba gratis). */
  badge?: boolean;
}

const useStyles = makeStyles((t) => ({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0 },
  bar: { flexDirection: 'row', padding: 5, ...shadowFor(t, 'soft') },
  highlight: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: radius.capsule,
    backgroundColor: withAlpha(t.colors.tint, t.dark ? 0.2 : 0.14),
    ...continuous,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 2 },
  label: { ...type.caption2, fontWeight: '600', color: t.colors.secondaryLabel },
  labelOn: { color: t.colors.tintText },
  badge: { position: 'absolute', top: -1, right: -5, width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.tint },
}));

/**
 * Barra de pestañas flotante de cristal, al estilo de iOS 26. La pastilla de
 * la pestaña activa se desliza con un muelle.
 */
export function TabBar<T extends string>({ tabs, active, onChange }: { tabs: Tab<T>[]; active: T; onChange: (key: T) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex((tab) => tab.key === active));
  const segment = width > 0 ? (width - 10) / tabs.length : 0;
  const offset = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (segment === 0) return;
    if (reduced || !placed.current) {
      placed.current = true;
      offset.setValue(index * segment);
      return;
    }
    Animated.spring(offset, { toValue: index * segment, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start();
  }, [index, offset, reduced, segment]);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
      <GlassSurface material="thick" cornerRadius={radius.capsule} style={styles.bar}>
        <View
          style={{ flexDirection: 'row', flex: 1 }}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width + 10)}
          accessibilityRole="tablist">
          {segment > 0 ? (
            <Animated.View style={[styles.highlight, { top: 0, bottom: 0, left: 0, width: segment, transform: [{ translateX: offset }] }]} />
          ) : null}
          {tabs.map((tab) => {
            const on = tab.key === active;
            return (
              <Pressable
                key={tab.key}
                style={styles.item}
                onPress={() => {
                  if (on) return;
                  tap('selection');
                  onChange(tab.key);
                }}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: on }}>
                <View>
                  <Icon name={tab.icon} size={22} color={on ? colors.tintText : colors.secondaryLabel} strokeWidth={on ? 2.1 : 1.8} />
                  {tab.badge ? <View style={styles.badge} /> : null}
                </View>
                <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

/** Altura que ocupa la barra, para dejar sitio al final de cada pantalla. */
export const TAB_BAR_SPACE = 96;
