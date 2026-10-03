import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, radius, spacing, type, useTheme, withAlpha } from '../theme';
import { tap } from './controls';
import { Icon, type IconName } from './Icon';
import { GlassSurface } from './Surface';

const useStyles = makeStyles((t) => ({
  section: { gap: 6 },
  header: { ...type.footnote, color: t.colors.secondaryLabel, paddingHorizontal: spacing.lg, textTransform: 'uppercase', letterSpacing: 0.3 },
  footer: { ...type.footnote, color: t.colors.secondaryLabel, paddingHorizontal: spacing.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.separator, marginLeft: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  rowPressed: { backgroundColor: t.colors.quaternaryFill },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.body, color: t.colors.label },
  rowSubtitle: { ...type.footnote, color: t.colors.secondaryLabel },
  rowValue: { ...type.body, color: t.colors.secondaryLabel },
  block: { padding: spacing.md },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitleText: { ...type.title3, fontWeight: '700', color: t.colors.label, flex: 1 },

  notice: { padding: spacing.lg, gap: spacing.sm },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeTitle: { ...type.headline, flex: 1 },
  noticeBody: { ...type.subheadline, color: t.colors.label },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs },
  noticeAction: { ...type.subheadline, fontWeight: '600' },

  pill: { minHeight: 30, justifyContent: 'center' },
  pillContent: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillLabel: { ...type.footnote, fontWeight: '600' },
}));

/** Grupo de filas al estilo de Ajustes de iOS, con cabecera y nota al pie. */
export function Section({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      {header ? (
        <Text style={styles.header} accessibilityRole="header">
          {header}
        </Text>
      ) : null}
      <GlassSurface material="regular" cornerRadius={radius.medium}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {row}
          </Fragment>
        ))}
      </GlassSurface>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

/** Fila: icono opcional en su cuadradito de color, título, explicación y control. */
export function Row({
  title,
  subtitle,
  icon,
  iconColor,
  accessory,
  onPress,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: iconColor ?? colors.tint }]}>
          <Icon name={icon} size={18} color="#FFFFFF" strokeWidth={2.1} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {accessory}
      {onPress ? <Icon name="chevron" size={16} color={colors.tertiaryLabel} strokeWidth={2.4} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={() => {
        tap('light');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

/** Texto gris a la derecha de una fila. */
export function RowValue({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.rowValue}>{children}</Text>;
}

/** Bloque libre dentro de una sección (un segmentado, unos días…). */
export function SectionBlock({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.block}>{children}</View>;
}

/** Título de tarjeta: el icono en su color y el nombre en negrita, como Things. */
export function SectionTitle({ icon, color, title, trailing }: { icon: IconName; color: string; title: string; trailing?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionTitle}>
      <Icon name={icon} color={color} size={22} />
      <Text style={styles.sectionTitleText} accessibilityRole="header">
        {title}
      </Text>
      {trailing}
    </View>
  );
}

export interface NoticeAction {
  label: string;
  onPress: () => void;
}

/** Aviso dentro de la pantalla (no la alarma): sensor movido, fuera de horario… */
export function Notice({
  tone,
  title,
  body,
  actions = [],
}: {
  tone: 'info' | 'warn' | 'danger';
  title: string;
  body: string;
  actions?: NoticeAction[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = tone === 'danger' ? colors.red : tone === 'warn' ? colors.yellow : colors.tint;
  const textColor = tone === 'info' ? colors.tintText : color;
  return (
    <GlassSurface material="regular" cornerRadius={radius.large} tintColor={withAlpha(color, 0.12)} style={styles.notice}>
      <View accessible accessibilityRole="alert" style={styles.noticeHead}>
        <Icon name={tone === 'info' ? 'clock' : 'bell'} size={20} color={textColor} />
        <Text style={[styles.noticeTitle, { color: textColor }]}>{title}</Text>
      </View>
      <Text style={styles.noticeBody}>{body}</Text>
      {actions.length > 0 ? (
        <View style={styles.noticeActions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                tap('light');
                action.onPress();
              }}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={[styles.noticeAction, { color: textColor }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </GlassSurface>
  );
}

/** Cápsula de estado. Resaltada lleva el cristal teñido de su color. */
export function Pill({ label, color, emphasized = false }: { label: string; color: string; emphasized?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
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
