import type { Phase } from './postureEngine';
import type { ShapeName } from './shapes';

/**
 * Cómo se expresa cada fase en la interfaz de Material 3 Expressive, igual en
 * el móvil y en el portátil:
 *
 * - `urgency` (0-1): altura y velocidad de la onda del anillo. Con la postura
 *   bien el arco va liso; en la alarma, la onda es fuerte y corre deprisa.
 * - `shape`: la forma de fondo de la cifra, de redonda a estallido.
 */
export const PHASE_URGENCY: Record<Phase, number> = {
  idle: 0,
  ok: 0,
  cooldown: 0,
  slouching: 0.35,
  scare: 0.6,
  countdown: 0.8,
  alarm: 1,
};

export const PHASE_SHAPE: Record<Phase, ShapeName> = {
  idle: 'circle',
  ok: 'cookie9',
  cooldown: 'cookie9',
  slouching: 'cookie6',
  scare: 'flower8',
  countdown: 'flower8',
  alarm: 'burst12',
};

export interface Expression {
  urgency: number;
  shape: ShapeName;
}

/**
 * Expresión de una fase. En una sesión de control nada pasa de «te estás
 * agachando»: enseñar la urgencia de la alarma sería avisar.
 */
export function expressionFor(phase: Phase, controlMode: boolean): Expression {
  if (controlMode && PHASE_URGENCY[phase] > PHASE_URGENCY.slouching) {
    return { urgency: PHASE_URGENCY.slouching, shape: PHASE_SHAPE.slouching };
  }
  return { urgency: PHASE_URGENCY[phase], shape: PHASE_SHAPE[phase] };
}
