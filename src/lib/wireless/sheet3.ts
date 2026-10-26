export type Practice = { label: string; answer: number; unit: string; tolerance?: number; hint: string };
export type Question = {
  id: number;
  title: string;
  topic: string;
  given?: string[];
  steps: { title: string; body: string }[];
  practice?: Practice[];
  takeaway: string;
};

export const formulas = [
  ['Wavelength', 'λ = c / f', 'Find wavelength from frequency.', 'm; use f in Hz'],
  ['Circular aperture', 'A = πD² / 4', 'Area from antenna diameter.', 'm²; use D in m'],
  ['Gain from area', 'G = 4πA / λ²', 'Receiver gain from effective area.', 'linear ratio'],
  ['Friis transmission', 'Pᵣ = PₜGₜGᵣ(λ / 4πd)²', 'Received power in free space.', 'W, m, linear gains'],
  ['Watts to dBm', 'P(dBm) = 10 log₁₀(P(W) × 1000)', 'Absolute power referenced to 1 mW.', 'dBm'],
  ['Free-space path loss', 'FSPL = 20 log₁₀(4πd / λ)', 'Loss over a free-space link.', 'dB'],
  ['Doppler magnitude', 'f_d = (v / c) f_c', 'Maximum frequency shift due to motion.', 'v in m/s; f in Hz'],
  ['Angled Doppler', 'f_d(θ) = f_d,max cos θ', 'Radial component of velocity.', 'θ uses the stated direction convention'],
  ['Received frequency', 'fᵣ ≈ f_c ± f_d', 'Toward is higher; away is lower.', 'Hz'],
  ['Coherence relation', 'T_c ∝ 1 / f_d', 'Faster Doppler means a faster-changing channel.', 'conceptual'],
  ['Power flux density', 'Φ = PₜGₜ / 4πd²', 'Power per square metre.', 'W/m²'],
  ['Power from flux', 'Pᵣ = ΦGᵣλ² / 4π', 'Power captured by the receiver.', 'W'],
  ['Path loss, linear', 'L_p = (4πd / λ)² / (GₜGᵣ)', 'Dimensionless loss ratio.', 'linear ratio'],
  ['Path loss from powers', 'L_p(dB) = 10 log₁₀(Pₜ / Pᵣ)', 'Loss when powers use the same unit.', 'dB'],
  ['Effective receiver area', 'A_e = Gᵣλ² / 4π', 'Area represented by receiver gain.', 'm²'],
  ['Reference-distance power', 'Pᵣ(d) = Pᵣ(d₀)(d₀ / d)²', 'Free-space power at a new distance.', 'same power unit'],
  ['Far-field distance', 'd_f = 2D² / λ', 'Minimum far-field distance.', 'm'],
  ['Coverage range', 'd = (λ / 4π) √(PₜGₜGᵣ / Pᵣ)', 'Range when received power reaches sensitivity.', 'm'],
  ['Path loss from reference', 'L_p(d) = L_p(d₀) + 20 log₁₀(d / d₀)', 'Free-space loss at a new distance.', 'dB'],
  ['Received power in dB', 'Pᵣ(d) = Pᵣ(d₀) + 20 log₁₀(d₀ / d)', 'Power at a new distance.', 'keep one logarithmic unit'],
  ['Electric field', '|E| = √(PₜGₜη / 4πd²)', 'Free-space electric-field magnitude.', 'η = 120π Ω; E in V/m'],
] as const;

export const conversions = [
  ['Length', '1 km = 10³ m; 1 m = 100 cm', '250 cm = 2.5 m'],
  ['Frequency', '1 GHz = 10⁹ Hz; 1 MHz = 10⁶ Hz; 1 kHz = 10³ Hz', '900 MHz = 9 × 10⁸ Hz'],
  ['Power', '1 W = 10³ mW = 10⁶ µW = 10⁹ nW', '30 mW = 0.03 W'],
  ['Time', '1 ms = 10⁻³ s; 1 µs = 10⁻⁶ s', '5 ms = 0.005 s'],
  ['Speed', 'km/h ÷ 3.6 = m/s', '120 km/h = 33.33 m/s'],
  ['Speed', 'mph × 0.44704 = m/s', '50 mph = 22.35 m/s'],
  ['Power level', 'dBm = dBW + 30', '0 dBW = 30 dBm'],
  ['Power ratio', 'linear = 10^(dB/10)', '30 dB = 1000 linear'],
] as const;

export const questions: Question[] = [
  {
    id: 1, topic: 'Antennas + Friis', title: 'Receiver gain and received power',
    given: ['Diameter D = 250 cm', 'Frequency f = 20 GHz', 'Transmit power Pₜ = 30 mW', 'Transmit gain Gₜ = 30 dB', 'Distance d = 5 km'],
    practice: [
      { label: 'Receiver gain', answer: 54.38, unit: 'dBi', tolerance: .01, hint: 'Find λ and aperture area first, then convert the linear gain to dB.' },
      { label: 'Received power', answer: .4685, unit: 'µW', tolerance: .02, hint: 'Convert both antenna gains to linear values before Friis.' },
    ],
    steps: [
      { title: 'Convert to SI', body: '<b>D = 250 cm ÷ 100 = 2.5 m</b>, <b>f = 20 × 10⁹ Hz</b>, <b>Pₜ = 30 mW ÷ 1000 = 0.03 W</b>, and <b>d = 5000 m</b>.' },
      { title: 'Find wavelength', body: 'λ = c/f = (3 × 10⁸)/(20 × 10⁹) = <b>0.015 m</b>.' },
      { title: 'Find aperture area', body: 'A = πD²/4 = π(2.5)²/4 = <b>4.909 m²</b>.' },
      { title: 'Find receiver gain', body: 'Gᵣ = 4πA/λ² = 4π(4.909)/(0.015)² = <b>2.742 × 10⁵ linear</b>. In dB: 10 log₁₀(Gᵣ) = <b>54.38 dBi</b>.' },
      { title: 'Use Friis', body: 'Convert Gₜ: 30 dB → 10^(30/10) = 1000. Then Pᵣ = 0.03(1000)(2.742 × 10⁵)[0.015/(4π × 5000)]² = <b>4.685 × 10⁻⁷ W = 0.4685 µW</b>.' },
    ], takeaway: 'Friis is a linear formula: watts, metres, hertz, and linear antenna gains only.',
  },
  {
    id: 2, topic: 'Power + path loss', title: '40 W free-space link at 900 MHz',
    given: ['Pₜ = 40 W', 'd = 1000 m', 'f = 900 MHz', 'Gₜ = Gᵣ = 0 dB'],
    practice: [
      { label: 'Transmit power', answer: 46.02, unit: 'dBm', tolerance: .01, hint: 'Multiply watts by 1000, then take 10 log₁₀.' },
      { label: 'Received power', answer: 28.1, unit: 'nW', tolerance: .03, hint: '0 dB means a linear gain of 1.' },
      { label: 'Free-space path loss', answer: 91.53, unit: 'dB', tolerance: .01, hint: 'Use 20 log₁₀(4πd/λ).' },
    ],
    steps: [
      { title: 'Convert power to dBm', body: 'P(dBm) = 10 log₁₀(40 × 1000) = <b>46.02 dBm</b>.' },
      { title: 'Find wavelength', body: '900 MHz = 900 × 10⁶ Hz, so λ = (3 × 10⁸)/(900 × 10⁶) = <b>0.3333 m</b>.' },
      { title: 'Use Friis', body: 'Gₜ = Gᵣ = 10^(0/10) = 1. Pᵣ = 40[0.3333/(4π × 1000)]² = <b>2.814 × 10⁻⁸ W = 28.14 nW</b>.' },
      { title: 'Calculate path loss', body: 'FSPL = 20 log₁₀(4π × 1000 / 0.3333) = <b>91.53 dB</b>. Check: 46.02 dBm − 91.53 dB = −45.51 dBm, the same received power.' },
    ], takeaway: 'A 0 dB antenna gain is 1 in linear scale, not zero.',
  },
  {
    id: 3, topic: 'Fading', title: 'Fast fading versus slow fading',
    steps: [
      { title: 'Fast fading', body: '<b>Rapid, small-scale change.</b> Multipath components add and cancel as the receiver moves a fraction of a wavelength or as the channel changes over a short time.' },
      { title: 'Slow fading', body: '<b>Gradual, large-scale change.</b> Buildings, trees, hills, and shadowing change average signal strength over much longer distances or times.' },
      { title: 'Memory hook', body: '<b>Fast = multipath ripples.</b> <b>Slow = obstacles and shadowing.</b>' },
    ], takeaway: 'Classify fading by how quickly the received signal changes relative to movement and time.',
  },
  {
    id: 4, topic: 'Doppler', title: 'Vehicle at 50 mph and a 900 MHz carrier',
    given: ['Speed v = 50 mph', 'Carrier f_c = 900 MHz'],
    practice: [
      { label: 'Maximum Doppler shift', answer: 67.06, unit: 'Hz', tolerance: .02, hint: 'Convert mph to m/s, then use (v/c)f_c.' },
      { label: 'Toward the base station', answer: 900.000067, unit: 'MHz', tolerance: .000001, hint: 'Toward means the received frequency increases.' },
      { label: 'Away from the base station', answer: 899.999933, unit: 'MHz', tolerance: .000001, hint: 'Away means the received frequency decreases.' },
      { label: '60° to arrival direction', answer: 900.000034, unit: 'MHz', tolerance: .000001, hint: 'Only the radial component counts: cos 60° = 0.5.' },
    ],
    steps: [
      { title: 'Convert speed and frequency', body: 'v = 50 × 0.44704 = <b>22.352 m/s</b>. f_c = 900 × 10⁶ Hz.' },
      { title: 'Maximum Doppler', body: 'f_d,max = (22.352 / 3 × 10⁸)(900 × 10⁶) = <b>67.056 Hz</b>.' },
      { title: 'Moving toward', body: 'Toward gives a positive shift: fᵣ = 900 MHz + 67.056 Hz = <b>900.000067 MHz</b>.' },
      { title: 'Moving away', body: 'Away gives a negative shift: fᵣ = 900 MHz − 67.056 Hz = <b>899.999933 MHz</b>.' },
      { title: 'At 60 degrees', body: 'Radial shift = 67.056 cos 60° = 33.528 Hz. With the stated motion having a toward component, fᵣ = <b>900.000034 MHz</b>.' },
    ], takeaway: 'State the angle convention, then use the sign physically: toward is higher frequency; away is lower.',
  },
  {
    id: 5, topic: 'Doppler + coherence', title: '120 km/h receiver at 2 GHz',
    given: ['Coherence time T_c = 5 ms', 'Speed v = 120 km/h', 'Carrier f_c = 2 GHz'],
    practice: [{ label: 'Maximum Doppler shift', answer: 222.22, unit: 'Hz', tolerance: .02, hint: '120 km/h ÷ 3.6 = 33.33 m/s.' }],
    steps: [
      { title: 'Convert speed', body: 'v = 120/3.6 = <b>33.333 m/s</b>.' },
      { title: 'Calculate Doppler', body: 'f_d = (33.333 / 3 × 10⁸)(2 × 10⁹) = <b>222.22 Hz</b>.' },
      { title: 'Connect it to coherence time', body: 'T_c is inversely related to Doppler spread. A larger f_d means <b>smaller coherence time</b> and a channel that changes faster.' },
      { title: 'System effect', body: 'Faster channel variation makes estimation and tracking harder, increases ICI/ISI risk (especially in OFDM), raises BER, and reduces link reliability.' },
    ], takeaway: 'Higher motion → higher Doppler → shorter coherence time → faster fading.',
  },
  {
    id: 6, topic: 'Flux + link budget', title: '10 W link over 7 km at 6 GHz',
    given: ['Pₜ = 10 W', 'd = 7 km', 'f = 6 GHz', 'Gₜ = 7 linear', 'Gᵣ = 2 linear'],
    practice: [
      { label: 'Power flux density', answer: 1.137e-7, unit: 'W/m²', tolerance: .03, hint: 'Use PₜGₜ/(4πd²).' },
      { label: 'Received power', answer: 4.524e-11, unit: 'W', tolerance: .03, hint: 'Find λ, then multiply flux by Gᵣλ²/(4π).' },
      { label: 'Path loss', answer: 113.45, unit: 'dB', tolerance: .01, hint: 'Use 10 log₁₀(Pₜ/Pᵣ).' },
      { label: 'Effective receiver area', answer: 3.979e-4, unit: 'm²', tolerance: .03, hint: 'A_e = Gᵣλ²/(4π).' },
    ],
    steps: [
      { title: 'Convert and find wavelength', body: 'd = 7000 m; f = 6 × 10⁹ Hz; λ = c/f = <b>0.05 m</b>.' },
      { title: 'Flux density', body: 'Φ = 10(7)/[4π(7000)²] = <b>1.137 × 10⁻⁷ W/m²</b>.' },
      { title: 'Receiver effective area', body: 'A_e = Gᵣλ²/(4π) = 2(0.05)²/(4π) = <b>3.979 × 10⁻⁴ m²</b>.' },
      { title: 'Received power', body: 'Pᵣ = ΦA_e = (1.137 × 10⁻⁷)(3.979 × 10⁻⁴) = <b>4.524 × 10⁻¹¹ W</b>.' },
      { title: 'Path loss', body: 'L_p = 10 log₁₀(10 / 4.524 × 10⁻¹¹) = <b>113.45 dB</b>.' },
    ], takeaway: 'Flux density describes the wave at the receiver; effective area tells how much of it the antenna captures.',
  },
  {
    id: 7, topic: 'Reference distance', title: 'Scale received power from 1 km to 20 km',
    given: ['Pᵣ(d₀) = 1 mW', 'd₀ = 1 km', 'd = 20 km'],
    practice: [{ label: 'Received power at 20 km', answer: 2.5, unit: 'µW', tolerance: .02, hint: 'Free-space power follows the inverse square of distance.' }],
    steps: [
      { title: 'Use one distance unit', body: 'Both distances are already in km, so their ratio is unitless: d₀/d = 1/20.' },
      { title: 'Apply inverse square', body: 'Pᵣ(d) = 1 mW(1/20)² = 1/400 mW = <b>0.0025 mW</b>.' },
      { title: 'Convert the result', body: '0.0025 mW × 1000 = <b>2.5 µW</b>.' },
    ], takeaway: 'Twenty times farther means 20² = 400 times less power in free space.',
  },
  {
    id: 8, topic: 'Antenna regions', title: 'Far-field distance at 900 MHz',
    given: ['Maximum antenna dimension D = 1 m', 'Frequency f = 900 MHz'],
    practice: [{ label: 'Far-field distance', answer: 6, unit: 'm', tolerance: .01, hint: 'Find λ first, then use 2D²/λ.' }],
    steps: [
      { title: 'Find wavelength', body: 'λ = (3 × 10⁸)/(900 × 10⁶) = <b>0.3333 m</b>.' },
      { title: 'Find boundary', body: 'd_f = 2D²/λ = 2(1)²/0.3333 = <b>6 m</b>.' },
    ], takeaway: 'Use the largest physical antenna dimension D, not the link distance.',
  },
  {
    id: 9, topic: 'Coverage', title: 'Maximum range for −90 dBm sensitivity',
    given: ['f = 800 MHz', 'Pₜ = 100 mW', 'Receiver sensitivity = −90 dBm', 'Assume unity gains'],
    practice: [{ label: 'Maximum coverage range', answer: 9.437, unit: 'km', tolerance: .02, hint: 'Convert sensitivity to watts, then rearrange Friis for d.' }],
    steps: [
      { title: 'Convert sensitivity', body: 'Pᵣ = 10^[(−90−30)/10] = <b>10⁻¹² W</b>.' },
      { title: 'Find wavelength', body: 'λ = (3 × 10⁸)/(800 × 10⁶) = <b>0.375 m</b>.' },
      { title: 'Rearrange Friis', body: 'd = (λ/4π)√(Pₜ/Pᵣ) = (0.375/4π)√(0.1/10⁻¹²) = <b>9437 m = 9.437 km</b>.' },
    ], takeaway: 'Receiver sensitivity is the minimum Pᵣ; set Friis equal to it and solve for distance.',
  },
  {
    id: 10, topic: 'Reference loss + E-field', title: '100 m link from a 20 mW transmitter',
    given: ['d = 100 m', 'd₀ = 1 m', 'Pᵣ(d₀) = −60 dB relative to its stated reference', 'L_p(d₀) = 43.01 dB', 'Gₜ = 8 dB'],
    practice: [
      { label: 'Path loss at 100 m', answer: 83.01, unit: 'dB', tolerance: .01, hint: 'Add 20 log₁₀(100/1).' },
      { label: 'Received power', answer: -100, unit: 'dBW', tolerance: .01, hint: '20 mW = −16.99 dBW; subtract path loss.' },
      { label: 'Electric field magnitude', answer: .01946, unit: 'V/m', tolerance: .02, hint: 'Convert 8 dB gain to 6.31 linear before the field formula.' },
    ],
    steps: [
      { title: 'Path loss at 100 m', body: 'L_p(d) = 43.01 + 20 log₁₀(100/1) = 43.01 + 40 = <b>83.01 dB</b>.' },
      { title: 'Put transmit power in dBW', body: 'Pₜ = 20 mW = 0.02 W. Pₜ(dBW) = 10 log₁₀(0.02) = <b>−16.99 dBW</b>.' },
      { title: 'Find received power', body: 'Pᵣ = Pₜ − L_p = −16.99 − 83.01 = <b>−100 dBW</b>, which is <b>−70 dBm</b>. The worksheet’s “−60 dB” reference value is ambiguous; always carry the reference unit.' },
      { title: 'Convert antenna gain', body: 'Gₜ = 10^(8/10) = <b>6.310 linear</b>.' },
      { title: 'Find electric field', body: '|E| = √[0.02(6.310)(120π)/(4π × 100²)] = <b>1.946 × 10⁻² V/m = 19.46 mV/m</b>.' },
    ], takeaway: 'dB is a ratio; dBm and dBW are absolute power levels. Never drop the reference.',
  },
];

