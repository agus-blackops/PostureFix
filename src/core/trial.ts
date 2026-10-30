/**
 * Prueba gratis de PostureFix Labs: 90 días desde la primera vez que se abre
 * la 2.0, sin tienda ni cuenta. Después, Labs pide la suscripción. Puro: el
 * momento de inicio se guarda fuera.
 */
export const TRIAL_DAYS = 90;
const DAY_MS = 86_400_000;

export interface TrialStatus {
  active: boolean;
  /** Días que quedan, redondeados hacia arriba (el último día cuenta como 1). */
  daysLeft: number;
  endsAt: number;
}

export function trialStatus(startedAt: number | null, now: number): TrialStatus {
  // Sin fecha guardada la prueba empieza ahora. Si el reloj se ha atrasado
  // por detrás del inicio, se cuenta desde ahora: nunca quedan más de 90 días.
  const start = startedAt == null || !Number.isFinite(startedAt) ? now : Math.min(startedAt, now);
  const endsAt = start + TRIAL_DAYS * DAY_MS;
  const left = endsAt - now;
  return { active: left > 0, daysLeft: left > 0 ? Math.ceil(left / DAY_MS) : 0, endsAt };
}
