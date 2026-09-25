import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Children, Fragment, useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { MOTION, rnSpring } from '../core/spring';
import { uiFeedback, type UiFeedback } from '../services/haptics';
import {
  colors,
  continuous,
  materials,
  radius,
  roundedNumbers,
  shadow,
  spacing,
  springs,
  type,
  withAlpha,
  type MaterialName,
} from './theme';

/**
 * Piezas de la interfaz hechas de cristal. En iOS 26 son Liquid Glass de verdad
 * (`expo-glass-effect`); en iOS anteriores, los materiales de desenfoque de
 * UIKit (`expo-blur`); en Android, un cristal translúcido con su filo de luz,
 * que el desenfoque en tiempo real allí cuesta batería y no aporta sobre un
 * fondo que ya es un degradado suave.
 */

const LIQUID_GLASS = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

let hapticsEnabled = true;

/** La interfaz sigue el ajuste de vibración de la app para sus toques suaves. */
export function setUiHaptics(enabled: boolean): void {
  hapticsEnabled = enabled;
}

function feedback(kind: UiFeedback): void {
  uiFeedback(kind, hapticsEnabled);
}

/** El mismo toque suave que dan los botones, para controles hechos fuera de aquí. */
export const uiTap = feedback;

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

// ------------------------------------------------------------- superficie ---

interface GlassSurfaceProps {
  children?: ReactNode;
  material?: MaterialName;
  cornerRadius?: number;
  /** Tinte del cristal, en rgba: rojo para parar, amarillo para un aviso... */
  tintColor?: string;
  /** El cristal reacciona al toque (solo Liquid Glass). */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** La base de todo: un trozo de cristal con esquinas continuas y filo de luz. */
export function GlassSurface({
  children,
  material = 'regular',
  cornerRadius = radius.large,
  tintColor,
  interactive = false,
  style,
}: GlassSurfaceProps) {
  const shape: StyleProp<ViewStyle> = [{ borderRadius: cornerRadius }, continuous, styles.clip];

  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={tintColor}
        isInteractive={interactive}
        style={[shape, style]}>
        {children}
      </GlassView>
    );
  }

  const spec = materials[material];
  return (
    <View style={[shape, styles.edge, Platform.OS === 'android' && { backgroundColor: spec.fallback }, style]}>
      {Platform.OS === 'android' ? null : (
        <BlurView tint={spec.tint} intensity={spec.intensity} style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}
      {tintColor ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
      ) : null}
      {children}
    </View>
  );
}

/** Tarjeta de cristal con el relleno y el espaciado de la app. */
export function Card({
  children,
  material = 'regular',
  tintColor,
  style,
}: {
  children: ReactNode;
  material?: MaterialName;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassSurface material={material} tintColor={tintColor} style={[styles.card, style]}>
      {children}
    </GlassSurface>
  );
}

// ---------------------------------------------------------------- fondo ---

/** Resplandor neutro para cuando no se está midiendo. */
const NEUTRAL_GLOW = colors.neutral;
const GLOW_COLORS = [NEUTRAL_GLOW, colors.green, colors.yellow, colors.tint, colors.red] as const;

const glowImage = (color: string) =>
  `radial-gradient(circle at 90% 100%, ${withAlpha(color, 0.24)} 0%, ${withAlpha(color, 0)} 60%)`;
const BASE_GLOW = `radial-gradient(circle at 0% 0%, ${withAlpha(colors.tint, 0.17)} 0%, ${withAlpha(
  colors.tint,
  0
)} 55%)`;

/** El degradado va por la propiedad nativa en iOS/Android y por CSS en la web. */
const gradientStyle = (image: string): ViewStyle =>
  (Platform.OS === 'web' ? { backgroundImage: image } : { experimental_backgroundImage: image }) as ViewStyle;

/**
 * Fondo de la app: negro cálido con dos resplandores, más tenues desde la
 * 1.1.3 para que mande el contenido, como en Things. El de arriba es siempre
 * el naranja de la marca; el de abajo toma el color del estado de la postura y
 * cambia con un fundido, así el cristal de encima se tiñe solo.
 */
export function AmbientBackground({ accent }: { accent: string }) {
  const target = (GLOW_COLORS as readonly string[]).includes(accent) ? accent : NEUTRAL_GLOW;
  const layers = useRef(
    Object.fromEntries(GLOW_COLORS.map((color) => [color, new Animated.Value(color === target ? 1 : 0)]))
  ).current;

  useEffect(() => {
    Animated.parallel(
      GLOW_COLORS.map((color) =>
        Animated.timing(layers[color], {
          toValue: color === target ? 1 : 0,
          duration: 700,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [layers, target]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.background]}>
      <View style={[StyleSheet.absoluteFill, gradientStyle(BASE_GLOW)]} />
      {GLOW_COLORS.map((color) => (
        <Animated.View
          key={color}
          style={[StyleSheet.absoluteFill, gradientStyle(glowImage(color)), { opacity: layers[color] }]}
        />
      ))}
    </View>
  );
}

// -------------------------------------------------------------- botones ---

/** Encogerse un poco al pulsar y volver con un rebote corto. */
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    pressIn: () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, ...rnSpring(MOTION.spatialFast) }).start(),
    pressOut: () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...rnSpring(MOTION.spatialDefault) }).start(),
  };
}

/**
 * Relleno de cristal sin forma propia: llena su contenedor, que es quien la
 * recorta. Lo usan los botones, cuya forma se anima.
 */
function GlassFill({ material = 'thin' }: { material?: MaterialName }) {
  if (LIQUID_GLASS) {
    return <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive style={StyleSheet.absoluteFill} />;
  }
  const spec = materials[material];
  if (Platform.OS === 'android') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: spec.fallback }]} />;
  }
  return <BlurView tint={spec.tint} intensity={spec.intensity} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}

/**
 * Forma animada de Material 3 Expressive: la esquina se cuadra al pulsar y el
 * botón pasa de píldora a rectángulo redondeado cuando está seleccionado.
 */
function useShapeMorph(height: number, selected: boolean) {
  const press = useRef(new Animated.Value(0)).current;
  const rest = useRef(new Animated.Value(selected ? height * 0.3 : height / 2)).current;

  useEffect(() => {
    Animated.spring(rest, {
      toValue: selected ? height * 0.3 : height / 2,
      useNativeDriver: false,
      ...rnSpring(MOTION.spatialDefault),
    }).start();
  }, [height, rest, selected]);

  const radius = Animated.subtract(rest, Animated.multiply(press, height * 0.18)).interpolate({
    inputRange: [0, height],
    outputRange: [0, height],
    extrapolate: 'clamp',
  });

  return {
    radius,
    pressIn: () => Animated.spring(press, { toValue: 1, useNativeDriver: false, ...rnSpring(MOTION.spatialFast) }).start(),
    pressOut: () => Animated.spring(press, { toValue: 0, useNativeDriver: false, ...rnSpring(MOTION.spatialDefault) }).start(),
  };
}

type ButtonVariant = 'prominent' | 'glass' | 'plain';
type ButtonSize = 'large' | 'regular' | 'small';

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** `prominent` es la acción principal; `glass`, la secundaria; `plain`, texto. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Relleno del botón `prominent` o color del texto en `glass` / `plain`. */
  color?: string;
  /** Texto sobre el relleno de `prominent`. */
  onColor?: string;
  disabled?: boolean;
  /** Estado seleccionado de un botón conmutable: cambia de forma. */
  selected?: boolean;
  /** El botón ocupa todo el ancho que le deja su fila. */
  stretch?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  haptic?: UiFeedback;
}

const BUTTON_HEIGHT: Record<ButtonSize, number> = { large: 56, regular: 48, small: 34 };

export function Button({
  label,
  onPress,
  variant = 'glass',
  size = 'regular',
  color,
  onColor = colors.onTint,
  disabled = false,
  selected = false,
  stretch = false,
  accessibilityLabel,
  accessibilityHint,
  haptic = 'light',
}: ButtonProps) {
  const { scale, pressIn, pressOut } = usePressScale();
  const height = BUTTON_HEIGHT[size];
  const shape = useShapeMorph(height, selected);
  const fill = color ?? colors.tint;
  const textColor = variant === 'prominent' ? onColor : (color ?? (variant === 'plain' ? colors.tint : colors.label));
  const labelStyle = size === 'small' ? styles.labelSmall : type.headline;

  return (
    <Animated.View
      style={[
        stretch && styles.stretch,
        { transform: [{ scale }] },
        variant === 'prominent' && size === 'large' && !disabled && [shadow.soft, { shadowColor: fill, shadowOpacity: 0.4 }],
        disabled && styles.disabled,
      ]}>
      <Pressable
        onPress={() => {
          feedback(haptic);
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
            { minHeight: height, borderRadius: shape.radius },
            size === 'small' && styles.buttonBodySmall,
            variant === 'prominent' && { backgroundColor: fill },
            variant === 'glass' && styles.edge,
          ]}>
          {variant === 'glass' ? <GlassFill /> : null}
          <Text style={[labelStyle, styles.buttonLabel, { color: textColor }]} numberOfLines={1}>
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

/**
 * Grupo de botones conectado de Material 3 Expressive: van pegados, con las
 * esquinas de dentro casi rectas. El que se pulsa se ensancha empujando a su
 * vecino y redondea sus esquinas interiores.
 */
export function ButtonGroup({ items }: { items: GroupItem[] }) {
  return (
    <View style={styles.buttonGroup}>
      {items.map((item, index) => (
        <GroupButton key={item.label} item={item} first={index === 0} last={index === items.length - 1} />
      ))}
    </View>
  );
}

function GroupButton({ item, first, last }: { item: GroupItem; first: boolean; last: boolean }) {
  const height = BUTTON_HEIGHT.regular;
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
          feedback('light');
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
            styles.edge,
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
          <Text style={[type.headline, styles.buttonLabel, { color: colors.label }]} numberOfLines={1}>
            {item.label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Botón redondo de cristal de 44 pt, la zona táctil mínima de Apple. */
export function IconButton({
  glyph,
  icon,
  onPress,
  accessibilityLabel,
}: {
  glyph?: string;
  /** Icono dibujado; si está, sustituye al glifo de texto. */
  icon?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { scale, pressIn, pressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          feedback('light');
          onPress();
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}>
        <GlassSurface material="thin" cornerRadius={radius.capsule} interactive style={styles.iconButton}>
          {/* En la web el SVG suelto quedaría debajo del desenfoque, que va posicionado. */}
          {icon ? <View>{icon}</View> : <Text style={styles.iconGlyph}>{glyph}</Text>}
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

// ------------------------------------------------------------- estados ---

/**
 * Cápsula de estado (vigilando, auriculares, tipo de alarma). Resaltada lleva
 * el cristal teñido del color; si no, se queda en gris para no competir.
 */
export function StatusPill({ label, color, emphasized = false }: { label: string; color: string; emphasized?: boolean }) {
  return (
    <GlassSurface
      material="thin"
      cornerRadius={radius.capsule}
      tintColor={emphasized ? withAlpha(color, 0.16) : undefined}
      style={styles.pill}>
      <View accessible accessibilityLabel={label} style={styles.pillContent}>
        <View style={[styles.pillDot, { backgroundColor: color }]} />
        <Text style={[styles.pillLabel, { color: emphasized ? color : colors.secondaryLabel }]}>{label}</Text>
      </View>
    </GlassSurface>
  );
}

// -------------------------------------------------------------- listas ---

/**
 * Grupo de filas al estilo de Ajustes de iOS: cabecera en versalitas, las filas
 * dentro de un mismo cristal con separadores sangrados y una nota al pie.
 */
export function ListGroup({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {header ? (
        <Text style={styles.groupHeader} accessibilityRole="header">
          {header.toUpperCase()}
        </Text>
      ) : null}
      <GlassSurface material="regular" cornerRadius={radius.medium}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.rowSeparator} /> : null}
            {row}
          </Fragment>
        ))}
      </GlassSurface>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

/** Fila de una lista: título, explicación opcional y el control a la derecha. */
export function ListRow({ title, subtitle, accessory }: { title: string; subtitle?: string; accessory?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {accessory}
    </View>
  );
}

/**
 * «Stepper» de iOS: una cápsula con − y + separados por una línea. Cada mitad
 * se apaga al llegar a su límite, en vez de aceptar toques que no hacen nada.
 */
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
  const half = (glyph: string, enabled: boolean, action: () => void, a11y: string) => (
    <Pressable
      disabled={!enabled}
      onPress={() => {
        feedback('selection');
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

/** Interruptor de iOS con el acento de la app y un toque al cambiarlo. */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={(next) => {
        feedback('selection');
        onValueChange(next);
      }}
      trackColor={{ false: colors.fill, true: colors.tint }}
      thumbColor={colors.label}
      ios_backgroundColor={colors.fill}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

// ------------------------------------------------------------ progreso ---

/** Barra de progreso en cápsula, que se mueve con un muelle y no a saltos. */
export function ProgressBar({
  progress,
  color,
  markAt,
  height = 8,
}: {
  progress: number;
  color: string;
  /** Marca fina en esa fracción de la barra: el umbral. */
  markAt?: number;
  height?: number;
}) {
  const target = clamp01(progress);
  const value = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.spring(value, { toValue: target, useNativeDriver: false, ...springs.value }).start();
  }, [target, value]);
  const width = value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.trackFill, { width, backgroundColor: color, borderRadius: height / 2 }]} />
      {markAt == null ? null : (
        <View style={[styles.trackMark, { left: `${clamp01(markAt) * 100}%` }]} />
      )}
    </View>
  );
}

/** Cifra grande en San Francisco redondeada. */
export function BigNumber({ children, color, size = 56 }: { children: ReactNode; color: string; size?: number }) {
  return (
    <Text
      style={[
        roundedNumbers,
        { color, fontSize: size, lineHeight: Math.round(size * 1.1), fontWeight: '700', letterSpacing: -0.5 },
      ]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  edge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassEdge,
    borderTopColor: colors.glassHighlight,
  },
  background: { backgroundColor: colors.background },

  card: { padding: spacing.xl, gap: spacing.md },

  stretch: { flex: 1 },
  disabled: { opacity: 0.4 },
  buttonBody: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...continuous,
  },
  buttonGroup: { flexDirection: 'row', gap: 3 },
  groupItem: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonBodySmall: { paddingHorizontal: spacing.lg },
  buttonLabel: { textAlign: 'center' },
  labelSmall: { ...type.subheadline, fontWeight: '600' },

  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 21, color: colors.label },

  pill: { minHeight: 30, justifyContent: 'center' },
  pillContent: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillLabel: { ...type.footnote, fontWeight: '600' },

  group: { gap: 6 },
  groupHeader: { ...type.footnote, color: colors.secondaryLabel, paddingHorizontal: spacing.lg },
  groupFooter: { ...type.footnote, color: colors.secondaryLabel, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.body, color: colors.label },
  rowSubtitle: { ...type.footnote, color: colors.secondaryLabel },
  rowSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.lg },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.tertiaryFill,
    ...continuous,
    overflow: 'hidden',
  },
  stepperHalf: { width: 46, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepperPressed: { backgroundColor: colors.fill },
  stepperGlyph: { fontSize: 22, lineHeight: 24, color: colors.label, fontWeight: '500' },
  stepperGlyphOff: { color: colors.quaternaryLabel },
  stepperDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.separator },

  track: { width: '100%', backgroundColor: colors.tertiaryFill, overflow: 'hidden', justifyContent: 'center' },
  trackFill: { height: '100%' },
  trackMark: { position: 'absolute', width: 3, marginLeft: -1.5, height: '100%', borderRadius: 2, backgroundColor: colors.label },

});
