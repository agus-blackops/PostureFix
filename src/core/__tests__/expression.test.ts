import { PHASE_SHAPE, PHASE_URGENCY, expressionFor } from '../expression';
import type { Phase } from '../postureEngine';
import { SHAPES } from '../shapes';

const PHASES: Phase[] = ['idle', 'ok', 'slouching', 'scare', 'countdown', 'alarm', 'cooldown'];

describe('expressionFor', () => {
  it('la urgencia crece según se acerca la alarma', () => {
    const order: Phase[] = ['ok', 'slouching', 'scare', 'countdown', 'alarm'];
    for (let i = 1; i < order.length; i++) {
      expect(PHASE_URGENCY[order[i]]).toBeGreaterThan(PHASE_URGENCY[order[i - 1]]);
    }
  });

  it('en calma el anillo va liso', () => {
    expect(expressionFor('idle', false).urgency).toBe(0);
    expect(expressionFor('ok', false).urgency).toBe(0);
    expect(expressionFor('cooldown', false).urgency).toBe(0);
  });

  it('en una sesión de control no se ve la urgencia de la alarma', () => {
    for (const phase of ['scare', 'countdown', 'alarm'] as Phase[]) {
      expect(expressionFor(phase, true)).toEqual(expressionFor('slouching', false));
    }
    expect(expressionFor('ok', true)).toEqual(expressionFor('ok', false));
  });

  it('cada fase tiene una forma conocida', () => {
    for (const phase of PHASES) expect(SHAPES[PHASE_SHAPE[phase]]).toBeDefined();
  });
});
