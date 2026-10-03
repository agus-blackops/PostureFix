import { EXPERIMENTS, FALLBACK_PRICES, annualSavings } from '../labs';
import { DEFAULT_SETTINGS } from '../settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('labs', () => {
  it('el plan anual sale un 33 % más barato que doce meses', () => {
    expect(annualSavings(FALLBACK_PRICES.monthly.amount, FALLBACK_PRICES.annual.amount)).toBe(0.33);
  });

  it('no promete un ahorro que no existe', () => {
    expect(annualSavings(1, 12)).toBeNull();
    expect(annualSavings(1, 20)).toBeNull();
    expect(annualSavings(0, 5)).toBeNull();
    expect(annualSavings(Number.NaN, 5)).toBeNull();
  });

  it('cada experimento tiene su interruptor en los ajustes', () => {
    for (const experiment of EXPERIMENTS) {
      expect(typeof DEFAULT_SETTINGS[experiment.key]).toBe('boolean');
    }
  });
});
