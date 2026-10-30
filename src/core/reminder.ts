/**
 * Recordatorio para levantarse: aunque la postura sea buena, pasar horas
 * sentado tampoco lo es. Cuenta el tiempo vigilando y, si la persona no se ha
 * movido un rato seguido (caminar se nota en la aceleración propia), avisa
 * cada `everyMs`. Puro, como la máquina de estados.
 */
export interface ReminderConfig {
  everyMs: number;
  /** Movimiento continuo que cuenta como «ya me he levantado». */
  resetAfterMovingMs: number;
}

export interface ReminderState {
  /** Tiempo sentado desde el último descanso. */
  sittingMs: number;
  /** Tiempo moviéndose seguido. */
  movingMs: number;
}

export const createReminder = (): ReminderState => ({ sittingMs: 0, movingMs: 0 });

export const DEFAULT_RESET_AFTER_MOVING_MS = 20_000;

export function reminderStep(
  state: ReminderState,
  input: { dtMs: number; moving: boolean },
  config: ReminderConfig
): { state: ReminderState; due: boolean } {
  const dtMs = Math.max(0, input.dtMs);
  const movingMs = input.moving ? state.movingMs + dtMs : 0;
  if (movingMs >= config.resetAfterMovingMs) {
    return { state: { sittingMs: 0, movingMs }, due: false };
  }
  const sittingMs = state.sittingMs + dtMs;
  if (sittingMs >= config.everyMs) {
    return { state: { sittingMs: 0, movingMs }, due: true };
  }
  return { state: { sittingMs, movingMs }, due: false };
}

export const REMINDER_MESSAGE = 'Llevas un buen rato sentado. Levántate y estira las piernas un minuto.';
