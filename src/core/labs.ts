/**
 * Catálogo de PostureFix Labs: qué desbloquea la suscripción y cuánto cuesta.
 *
 * Los precios de verdad los pone la tienda (App Store o Google Play) en la
 * moneda de cada país y llegan por RevenueCat; los de aquí sólo se enseñan si
 * la tienda no responde, para que la pantalla nunca quede vacía.
 */

/** Identificador del «entitlement» en RevenueCat: lo que da acceso a Labs. */
export const LABS_ENTITLEMENT = 'labs';

/** Productos que hay que crear en App Store Connect y en Google Play Console. */
export const LABS_PRODUCTS = {
  monthly: 'posturefix_labs_monthly',
  annual: 'posturefix_labs_annual',
} as const;

export type LabsPlan = keyof typeof LABS_PRODUCTS;

export const FALLBACK_PRICES: Record<LabsPlan, { amount: number; label: string; period: string }> = {
  monthly: { amount: 0.99, label: '0,99 €', period: 'al mes' },
  annual: { amount: 7.99, label: '7,99 €', period: 'al año' },
};

/**
 * Cuánto se ahorra con el plan anual frente a pagar doce meses, en tanto por
 * uno redondeado a entero (0,33 = un 33 %). `null` si los precios no cuadran.
 */
export function annualSavings(monthly: number, annual: number): number | null {
  if (!(monthly > 0) || !(annual > 0)) return null;
  const saving = 1 - annual / (monthly * 12);
  return saving > 0 ? Math.round(saving * 100) / 100 : null;
}

export type ExperimentKey = 'labsStreaks' | 'labsWeekly' | 'labsStretches';

export interface Experiment {
  key: ExperimentKey;
  title: string;
  description: string;
}

export const EXPERIMENTS: Experiment[] = [
  {
    key: 'labsStreaks',
    title: 'Objetivo diario y rachas',
    description: 'Minutos de buena postura al día, días seguidos cumpliéndolo e insignias.',
  },
  {
    key: 'labsWeekly',
    title: 'Informe semanal',
    description: 'Tu semana en un gráfico: tiempo encorvado, alertas y tu mejor día.',
  },
  {
    key: 'labsStretches',
    title: 'Estiramientos guiados',
    description: 'Rutinas de dos minutos para cuello, hombros y espalda, con voz.',
  },
];
