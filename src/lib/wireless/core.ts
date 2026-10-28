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


/* ------------------------------------------------------------ Lecture 1 helpers */

export const snrDb = (signalW: number, noiseW: number) => 10 * Math.log10(signalW / noiseW);
/** Shannon limit C = B·log₂(1 + SNR), with the SNR given in dB. */
export const shannonCapacity = (bandwidthHz: number, snrDecibels: number) => bandwidthHz * Math.log2(1 + dbToLinear(snrDecibels));
export const period = (frequencyHz: number) => 1 / frequencyHz;
/** Total transmit power of k equal hops relative to one hop over the same distance, for path loss ∝ dⁿ. */
export const multihopPowerRatio = (hops: number, n: number) => hops * (1 / hops) ** n;

export type Band = { id: string; name: string; from: number; to: number; uses: string; trait: string };
/** Slide 7: the radio bands, by frequency in Hz. */
export const BANDS: Band[] = [
  { id: 'HF', name: 'High Frequency', from: 3e6, to: 30e6, uses: 'Shortwave', trait: 'Ionospheric skywave gives global reach' },
  { id: 'VHF', name: 'Very High Frequency', from: 30e6, to: 300e6, uses: 'FM radio, television', trait: 'Line of sight with some diffraction' },
  { id: 'UHF', name: 'Ultra High Frequency', from: 300e6, to: 3e9, uses: 'Cellular, some sensor links', trait: 'Good building penetration' },
  { id: 'SHF', name: 'Super High Frequency', from: 3e9, to: 30e9, uses: 'Wi-Fi, microwave links', trait: 'High capacity; walls attenuate' },
  { id: 'EHF', name: 'Extremely High Frequency', from: 30e9, to: 300e9, uses: 'Millimetre-wave links', trait: 'Wide bandwidth; rain and oxygen absorb' },
];
export const bandOf = (frequencyHz: number) => BANDS.find((b) => frequencyHz >= b.from && frequencyHz < b.to) ?? null;

/** "0.125 m" → "12.5 cm"; picks km, m, cm, mm or µm. */
export function formatLength(m: number): string {
  const units: [number, string][] = [[1e3, 'km'], [1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm']];
  const [scale, unit] = units.find(([s]) => Math.abs(m) >= s) ?? units[units.length - 1];
  return `${Number((m / scale).toPrecision(3))} ${unit}`;
}
/** 2.4e9 → "2.4 GHz" */
export function formatHz(hz: number): string {
  const units: [number, string][] = [[1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']];
  const [scale, unit] = units.find(([s]) => Math.abs(hz) >= s) ?? units[units.length - 1];
  return `${Number((hz / scale).toPrecision(3))} ${unit}`;
}
/** 0.42e-9 → "0.417 ns" */
export function formatSeconds(s: number): string {
  const units: [number, string][] = [[1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns'], [1e-12, 'ps']];
  const [scale, unit] = units.find(([k]) => Math.abs(s) >= k * 0.1) ?? units[units.length - 1];
  return `${Number((s / scale).toPrecision(3))} ${unit}`;
}
/** 199.3e6 → "199 Mbps" */
export function formatRate(bps: number): string {
  const units: [number, string][] = [[1e9, 'Gbps'], [1e6, 'Mbps'], [1e3, 'kbps'], [1, 'bps']];
  const [scale, unit] = units.find(([s]) => Math.abs(bps) >= s) ?? units[units.length - 1];
  return `${Number((bps / scale).toPrecision(3))} ${unit}`;
}
