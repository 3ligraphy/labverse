export const C = 3e8;

export const wavelength = (frequencyHz: number) => C / frequencyHz;
export const dbToLinear = (db: number) => 10 ** (db / 10);
export const linearToDb = (ratio: number) => 10 * Math.log10(ratio);
export const wattsToDbm = (watts: number) => 10 * Math.log10(watts * 1000);
export const dbmToWatts = (dbm: number) => 10 ** ((dbm - 30) / 10);
export const freeSpacePathLossDb = (distanceM: number, frequencyHz: number) =>
  20 * Math.log10((4 * Math.PI * distanceM * frequencyHz) / C);
export const friisWatts = (powerW: number, gainTx: number, gainRx: number, frequencyHz: number, distanceM: number) =>
  powerW * gainTx * gainRx * (wavelength(frequencyHz) / (4 * Math.PI * distanceM)) ** 2;
export const dopplerHz = (speedMps: number, frequencyHz: number, angleDeg = 0) =>
  (speedMps / C) * frequencyHz * Math.cos((angleDeg * Math.PI) / 180);
export const farFieldDistance = (dimensionM: number, frequencyHz: number) =>
  (2 * dimensionM ** 2) / wavelength(frequencyHz);

export type Conversion = 'w-dbm' | 'dbm-w' | 'mw-dbm' | 'dbm-mw' | 'db-linear' | 'kmh-ms' | 'mph-ms' | 'ghz-hz' | 'mhz-hz' | 'cm-m';
export function convert(value: number, kind: Conversion): { value: number; unit: string } {
  const map: Record<Conversion, () => { value: number; unit: string }> = {
    'w-dbm': () => ({ value: wattsToDbm(value), unit: 'dBm' }),
    'dbm-w': () => ({ value: dbmToWatts(value), unit: 'W' }),
    'mw-dbm': () => ({ value: 10 * Math.log10(value), unit: 'dBm' }),
    'dbm-mw': () => ({ value: 10 ** (value / 10), unit: 'mW' }),
    'db-linear': () => ({ value: dbToLinear(value), unit: 'linear' }),
    'kmh-ms': () => ({ value: value / 3.6, unit: 'm/s' }),
    'mph-ms': () => ({ value: value * 0.44704, unit: 'm/s' }),
    'ghz-hz': () => ({ value: value * 1e9, unit: 'Hz' }),
    'mhz-hz': () => ({ value: value * 1e6, unit: 'Hz' }),
    'cm-m': () => ({ value: value / 100, unit: 'm' }),
  };
  return map[kind]();
}

export const closeEnough = (actual: number, expected: number, tolerance = 0.02) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(Math.abs(expected) * tolerance, tolerance * 1e-9);

