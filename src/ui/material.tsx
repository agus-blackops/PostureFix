import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { STATE_PRESSED, colors, elevation, shape, spacing, stateLayer, type } from './theme';

/**
 * Piezas de Material Design 3 hechas a mano sobre React Native: botones,
 * tarjetas, chips y filas de lista. Solo lo que la app usa, pero con las
 * medidas, formas y capas de estado que manda la especificación.
 */

type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Color de acento; por defecto el rol primary. Útil para el botón de parar. */
  color?: string;
  onColor?: string;
  disabled?: boolean;
  /** El botón ocupa todo el ancho disponible dentro de su fila. */
  stretch?: boolean;
  accessibilityLabel?: string;
}

/**
 * Botón de M3: 40 dp de alto, esquina de píldora y capa de estado al pulsar.
 * `filled` es la acción principal, `tonal` la secundaria destacada, `outlined`
 * la de contorno y `text` la de menor peso.
 */
export function Button({
  label,
  onPress,
  variant = 'filled',
  color = colors.primary,
  onColor = colors.onPrimary,
  disabled = false,
  stretch = false,
  accessibilityLabel,
}: ButtonProps) {
  const background =
    variant === 'filled' ? color : variant === 'tonal' ? colors.secondaryContainer : 'transparent';
  const content =
    variant === 'filled' ? onColor : variant === 'tonal' ? colors.onSecondaryContainer : color;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        stretch && styles.stretch,
        { backgroundColor: background },
        variant === 'outlined' && { borderWidth: 1, borderColor: colors.outline },
        variant === 'filled' && !disabled && elevation.level1,
        disabled && styles.disabled,
        pressed && !disabled && { backgroundColor: mix(background, content) },
      ]}>
      <Text style={[styles.buttonLabel, { color: content }, disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Botón extendido flotante (FAB): la acción principal de la pantalla, más alto
 * y más visible que un botón normal.
 */
export function ExtendedFab({
  label,
  onPress,
  color = colors.primaryContainer,
  onColor = colors.onPrimaryContainer,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  onColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.fab,
        elevation.level3,
        { backgroundColor: pressed ? mix(color, onColor) : color },
      ]}>
      <Text style={[styles.fabLabel, { color: onColor }]}>{label}</Text>
    </Pressable>
  );
}

/** Botón de icono de 48 dp con la zona táctil circular de M3. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = colors.onSurfaceVariant,
}: {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && { backgroundColor: stateLayer(tone, STATE_PRESSED) },
      ]}>
      <Text style={[styles.iconGlyph, { color: tone }]}>{icon}</Text>
    </Pressable>
  );
}

/**
 * Tarjeta de M3. `filled` se apoya en el color del contenedor, `elevated` añade
 * sombra y `outlined` solo contorno.
 */
export function Card({
  children,
  variant = 'filled',
  style,
}: {
  children: ReactNode;
  variant?: 'filled' | 'elevated' | 'outlined';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.card,
        variant === 'filled' && { backgroundColor: colors.surfaceContainerHighest },
        variant === 'elevated' && [{ backgroundColor: colors.surfaceContainerLow }, elevation.level1],
        variant === 'outlined' && {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * Chip de asistencia de M3: 32 dp de alto, esquina de 8 dp y contorno, o relleno
 * tonal cuando está seleccionado.
 */
export function Chip({
  label,
  tone = colors.onSurfaceVariant,
  selected = false,
}: {
  label: string;
  tone?: string;
  selected?: boolean;
}) {
  return (
    <View
      style={[
        styles.chip,
        selected
          ? { backgroundColor: stateLayer(tone, 0.18), borderColor: 'transparent' }
          : { borderColor: colors.outlineVariant },
      ]}>
      <View style={[styles.chipDot, { backgroundColor: tone }]} />
      <Text style={[styles.chipLabel, { color: selected ? tone : colors.onSurfaceVariant }]}>
        {label}
      </Text>
    </View>
  );
}

/** Cabecera de sección de una lista (list subheader de M3). */
export function Subheader({ children }: { children: ReactNode }) {
  return <Text style={styles.subheader}>{children}</Text>;
}

/** Fila de lista de M3: texto principal, texto de apoyo y un control al final. */
export function ListItem({
  headline,
  supporting,
  trailing,
}: {
  headline: string;
  supporting?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.listItem}>
      <View style={styles.listText}>
        <Text style={styles.listHeadline}>{headline}</Text>
        {supporting ? <Text style={styles.listSupporting}>{supporting}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

/** Separador fino entre filas. */
export function Divider() {
  return <View style={styles.divider} />;
}

/**
 * Indicador de progreso lineal de M3: pista, trazo y, opcionalmente, la marca
 * del umbral (el «stop indicator» de la especificación).
 */
export function LinearIndicator({
  progress,
  color,
  markAt,
  thin = false,
}: {
  progress: number;
  color: string;
  markAt?: number;
  thin?: boolean;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={[styles.track, thin && styles.trackThin]}>
      <View style={[styles.trackFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
      {markAt == null ? null : (
        <View style={[styles.trackMark, { left: `${Math.min(1, markAt) * 100}%` }]} />
      )}
    </View>
  );
}

/** Mezcla la capa de estado (12 %) del contenido sobre el contenedor. */
function mix(background: string, content: string): string {
  return background === 'transparent' ? stateLayer(content, STATE_PRESSED) : shade(background, content);
}

/** Aclara u oscurece el contenedor acercándolo al color de su contenido. */
function shade(background: string, content: string): string {
  const bg = channels(background);
  const fg = channels(content);
  const blended = bg.map((value, i) => Math.round(value + (fg[i] - value) * STATE_PRESSED));
  return `rgb(${blended[0]}, ${blended[1]}, ${blended[2]})`;
}

function channels(hex: string): number[] {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    borderRadius: shape.full,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stretch: { flex: 1 },
  buttonLabel: { ...type.labelLarge, textAlign: 'center' },
  disabled: { backgroundColor: stateLayer(colors.onSurface, 0.12), borderColor: 'transparent' },
  disabledLabel: { color: stateLayer(colors.onSurface, 0.38) },

  fab: {
    minHeight: 56,
    borderRadius: shape.large,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: { ...type.titleMedium },

  iconButton: {
    width: 48,
    height: 48,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 22 },

  card: { borderRadius: shape.large, padding: spacing.lg, gap: spacing.sm },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 32,
    borderRadius: shape.small,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  chipDot: { width: 8, height: 8, borderRadius: shape.full },
  chipLabel: { ...type.labelLarge },

  subheader: {
    ...type.titleSmall,
    color: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listText: { flex: 1, gap: 2 },
  listHeadline: { ...type.bodyLarge, color: colors.onSurface },
  listSupporting: { ...type.bodyMedium, color: colors.onSurfaceVariant },

  divider: { height: 1, backgroundColor: colors.outlineVariant, marginHorizontal: spacing.lg },

  track: {
    width: '100%',
    height: 8,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trackThin: { height: 4 },
  trackFill: { height: '100%', borderRadius: shape.full },
  trackMark: { position: 'absolute', width: 4, height: '100%', borderRadius: shape.full, backgroundColor: colors.onSurface },
});
