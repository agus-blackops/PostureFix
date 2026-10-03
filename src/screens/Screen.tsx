import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from '../components/motion';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { makeStyles, spacing, type } from '../theme';

const useStyles = makeStyles((t) => ({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.sm },
  headerText: { flex: 1 },
  title: { ...type.largeTitle, color: t.colors.label },
  subtitle: { ...type.subheadline, color: t.colors.secondaryLabel },
}));

/** Pantalla con título grande de iOS y sitio al final para la barra de pestañas. */
export function Screen({ title, subtitle, trailing, children }: { title: string; subtitle?: string; trailing?: ReactNode; children: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: TAB_BAR_SPACE + insets.bottom + spacing.lg }]}
      showsVerticalScrollIndicator={false}>
      <Appear index={0} style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailing}
      </Appear>
      {children}
    </ScrollView>
  );
}
