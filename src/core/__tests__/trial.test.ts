import { TRIAL_DAYS, trialStatus } from '../trial';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1);

describe('trial', () => {
  it('dura 90 días desde la primera apertura', () => {
    expect(trialStatus(START, START)).toMatchObject({ active: true, daysLeft: TRIAL_DAYS });
    expect(trialStatus(START, START + 89.5 * DAY)).toMatchObject({ active: true, daysLeft: 1 });
    expect(trialStatus(START, START + 90 * DAY)).toMatchObject({ active: false, daysLeft: 0 });
  });

  it('sin fecha guardada empieza ahora', () => {
    expect(trialStatus(null, START).endsAt).toBe(START + TRIAL_DAYS * DAY);
  });

  it('con el reloj atrasado nunca quedan más de 90 días', () => {
    expect(trialStatus(START + 30 * DAY, START).daysLeft).toBe(TRIAL_DAYS);
  });
});
