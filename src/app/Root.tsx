import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlertOverlay } from '../components/AlertOverlay';
import { setUiHaptics } from '../components/controls';
import { LoadingIndicator } from '../components/indicators';
import { useReducedMotion } from '../components/motion';
import { Background } from '../components/Surface';
import { TabBar, type Tab } from '../components/TabBar';
import { MOTION, rnSpring } from '../core/spring';
import type { Routine } from '../core/stretches';
import { CalibrationSheet } from '../screens/CalibrationSheet';
import { LabsScreen } from '../screens/LabsScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StretchSheet } from '../screens/StretchSheet';
import { TodayScreen } from '../screens/TodayScreen';
import { ThemeProvider, phaseColor, useTheme } from '../theme';
import { AppProvider, useApp } from './AppContext';

type TabKey = 'hoy' | 'progreso' | 'labs' | 'ajustes';

/** Raíz de la 2.0: estado de la app, tema y la estructura con pestañas. */
export function Root() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        {({ monitor }) => (
          <ThemeProvider mode={monitor.settings.theme}>
            <Shell />
          </ThemeProvider>
        )}
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const theme = useTheme();
  const { monitor, labs } = useApp();
  const [tab, setTab] = useState<TabKey>('hoy');
  const [calibrating, setCalibrating] = useState(false);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const { settings, engine } = monitor;

  useEffect(() => setUiHaptics(settings.uiHaptics), [settings.uiHaptics]);

  const tabs: Tab<TabKey>[] = [
    { key: 'hoy', label: 'Hoy', icon: 'today' },
    { key: 'progreso', label: 'Progreso', icon: 'chart' },
    { key: 'labs', label: 'Labs', icon: 'flask', badge: !labs.subscribed && !!labs.trial?.active && tab !== 'labs' },
    { key: 'ajustes', label: 'Ajustes', icon: 'gear' },
  ];

  const accent = monitor.running ? phaseColor(theme.colors, engine.phase, settings.controlMode) : theme.colors.neutral;
  const openCalibration = () => setCalibrating(true);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Background accent={accent} />

      {monitor.ready ? (
        <>
          <TabPage active={tab === 'hoy'}>
            <TodayScreen onCalibrate={openCalibration} onOpenProgress={() => setTab('progreso')} />
          </TabPage>
          <TabPage active={tab === 'progreso'}>
            <ProgressScreen onOpenLabs={() => setTab('labs')} />
          </TabPage>
          <TabPage active={tab === 'labs'}>
            <LabsScreen onStretch={setRoutine} />
          </TabPage>
          <TabPage active={tab === 'ajustes'}>
            <SettingsScreen onCalibrate={openCalibration} />
          </TabPage>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
        </>
      ) : (
        <View style={styles.loading}>
          <LoadingIndicator size={64} />
        </View>
      )}

      <CalibrationSheet visible={calibrating} onClose={() => setCalibrating(false)} />
      <StretchSheet
        routine={routine}
        onClose={() => setRoutine(null)}
        voiceEnabled={settings.voiceEnabled}
        vibrationEnabled={settings.vibrationEnabled}
      />
      <AlertOverlay phase={engine.phase} countsSpoken={engine.countsSpoken} controlMode={settings.controlMode} />
    </View>
  );
}

/**
 * Las cuatro pantallas viven montadas (no pierden el scroll ni su estado) y
 * la activa aparece con un fundido y un desplazamiento corto con muelle.
 */
function TabPage({ active, children }: { active: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) setVisible(true);
    const animation = reduced
      ? Animated.timing(progress, { toValue: active ? 1 : 0, duration: 120, useNativeDriver: true })
      : Animated.spring(progress, { toValue: active ? 1 : 0, useNativeDriver: true, ...rnSpring(active ? MOTION.spatialDefault : MOTION.effectsFast) });
    animation.start(({ finished }) => {
      if (finished && !active) setVisible(false);
    });
  }, [active, progress, reduced]);

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
        !visible && styles.hidden,
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hidden: { display: 'none' },
});
