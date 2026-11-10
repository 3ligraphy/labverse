/**
 * WIRELESS NETWORKS · LECTURE 1 — "Wireless communication: fundamentals of wireless signals and networks".
 * Every section of the interactive lecture names the PDF pages (slides) it teaches, so the page can open the
 * slide image or the PDF at exactly that page. The slide text itself is taught in src/pages/wireless/lectures/lecture-01.astro.
 */
export const PDF = '/wireless/lecture-01/WN_Lecture_1.pdf';
export const PDF_PAGES = 25;
export const slideImage = (page: number) => `/wireless/lecture-01/slide-${String(page).padStart(2, '0')}.webp`;

export type Section = { id: string; title: string; pages: number[]; idea: string };
export type Chapter = { id: string; title: string; blurb: string; sections: Section[] };

export const chapters: Chapter[] = [
  {
    id: 'why', title: 'Why wireless?', blurb: 'What wireless communication is, how computing became mobile, and what wireless gives us.',
    sections: [
      { id: 'cover', title: 'Lecture 1 at a glance', pages: [1], idea: 'Wireless networks, module leader and the lecture route' },
      { id: 'communication', title: 'Wireless communication', pages: [2], idea: 'Transmitter → wireless channel → receiver, and SNR' },
      { id: 'personal', title: 'Computing becomes personal and mobile', pages: [3], idea: 'From room-sized mainframes to devices in your pocket' },
      { id: 'why-wireless', title: 'Why wireless networks?', pages: [4], idea: 'Access and mobility · deployment and growth · CAPEX and OPEX' },
      { id: 'milestones', title: 'Milestones in wireless communication', pages: [5], idea: '1896 → 1901 → 1960s → 1G to 5G and Wi-Fi' },
      { id: 'broadband', title: 'Broadband wireless technology', pages: [6], idea: 'Shannon limit C = B·log₂(1 + SNR)' },
    ],
  },
  {
    id: 'technology', title: 'Technologies & access', blurb: 'The radio bands, cellular and Wi-Fi generations, what improves performance and the challenges.',
    sections: [
      { id: 'bands', title: 'Wireless technologies across the spectrum', pages: [7], idea: 'HF · VHF · UHF · SHF · EHF and their wavelengths' },
      { id: 'evolution', title: 'Evolution of cellular and Wi-Fi systems', pages: [8], idea: '4G → 5G and Wi-Fi 4 → 5 → 6' },
      { id: 'performance', title: 'What improves wireless performance?', pages: [9], idea: 'Hardware · radio link · network' },
      { id: 'access', title: 'Wireless information access', pages: [10], idea: 'Anytime, anywhere, any form · PAN, LAN, WAN' },
      { id: 'challenges', title: 'Challenges in wireless networks', pages: [11], idea: 'Variable channel and shared radio medium · Doppler shift' },
      { id: 'around', title: 'Wireless around us', pages: [12], idea: 'Cells, satellites, Wi-Fi, Bluetooth LE and NFC' },
    ],
  },
  {
    id: 'organization', title: 'Network organization', blurb: 'How wireless networks are organized: with or without infrastructure, one hop or many.',
    sections: [
      { id: 'classification', title: 'Classification of wireless networks', pages: [13], idea: 'Infrastructure-based vs infrastructure-less (direct, multihop)' },
      { id: 'hops', title: 'Single-hop and multihop communication', pages: [14], idea: 'Why two short hops can need less power than one long hop' },
    ],
  },
  {
    id: 'signals', title: 'Wireless signals', blurb: 'What travels between devices: electromagnetic waves, their properties, and how they carry bits.',
    sections: [
      { id: 'medium', title: 'The wireless medium', pages: [15], idea: 'Electromagnetic energy, no medium needed, 1/r² spreading' },
      { id: 'em-waves', title: 'Wireless signals are electromagnetic waves', pages: [16], idea: 'E and B fields, polarization, c ≈ 3 × 10⁸ m/s' },
      { id: 'amplitude', title: 'Amplitude and wavelength', pages: [17], idea: 'Power ∝ A² · half-wave dipole is λ/2' },
      { id: 'frequency', title: 'Frequency and period', pages: [18, 19], idea: 'f = 1 / T · higher frequency means more cycles' },
      { id: 'wavelength', title: 'Frequency and wavelength', pages: [20], idea: 'λ = c / f · λ (m) = 300 / f (MHz)' },
      { id: 'modulation', title: 'Modulation carries information', pages: [21], idea: 'ASK, FSK, PSK and QAM' },
      { id: 'spectrum', title: 'The electromagnetic spectrum', pages: [22], idea: 'Radio to gamma; all travel at c' },
      { id: 'examples', title: 'Frequency examples in everyday systems', pages: [23], idea: 'AM, FM, TV and cellular, Wi-Fi, satellite' },
    ],
  },
  {
    id: 'review', title: 'Check & recap', blurb: 'Test yourself with the lecture’s quick check, then lock in the four big ideas.',
    sections: [
      { id: 'check', title: 'Quick understanding check', pages: [24], idea: 'Five questions from the lecture, with answers' },
      { id: 'recap', title: 'Lecture 1 recap', pages: [25], idea: 'The four big ideas and their formulas' },
    ],
  },
];

export const sections = chapters.flatMap((c) => c.sections.map((s) => ({ ...s, chapter: c.id })));

/** Every abbreviation the slides define, so none is lost. Each entry: [term, meaning, slide]. */
export const glossary: [string, string, number][] = [
  ['dB', 'decibel', 2],
  ['SNR', 'signal-to-noise ratio', 2],
  ['IoT', 'Internet of Things', 3],
  ['CAPEX', 'installation (capital) cost', 4],
  ['OPEX', 'operating cost', 4],
  ['TV', 'television', 5],
  ['WLAN', 'wireless local area network', 5],
  ['IEEE', 'Institute of Electrical and Electronics Engineers', 5],
  ['1G–5G', 'first to fifth generation of cellular', 5],
  ['MHz', 'megahertz (10⁶ Hz)', 7],
  ['GHz', 'gigahertz (10⁹ Hz)', 7],
  ['FM', 'frequency modulation', 7],
  ['LTE', 'Long Term Evolution', 8],
  ['OFDMA', 'Orthogonal Frequency-Division Multiple Access', 8],
  ['NR', 'New Radio', 8],
  ['MIMO', 'multiple-input multiple-output', 8],
  ['QAM', 'quadrature amplitude modulation', 8],
  ['mmWave', 'millimetre wave', 8],
  ['Mbps / Gbps', 'megabits / gigabits per second', 8],
  ['CMOS', 'complementary metal-oxide-semiconductor', 9],
  ['RFIC', 'radio-frequency integrated circuit', 9],
  ['DSP', 'digital signal processing', 9],
  ['LDPC', 'low-density parity-check', 9],
  ['PAN', 'personal area network', 10],
  ['LAN', 'local area network', 10],
  ['WAN', 'wide area network', 10],
  ['MAC', 'medium access control', 11],
  ['WPA3', 'Wi-Fi Protected Access 3', 11],
  ['GNSS', 'Global Navigation Satellite System', 12],
  ['GPS', 'Global Positioning System', 12],
  ['NFC', 'near-field communication', 12],
  ['MANET', 'mobile ad hoc network', 13],
  ['VANET', 'vehicular ad hoc network', 13],
  ['WSN', 'wireless sensor network', 13],
  ['ASK', 'amplitude-shift keying', 21],
  ['FSK', 'frequency-shift keying', 21],
  ['PSK', 'phase-shift keying', 21],
  ['Li-Fi', 'light fidelity (data over visible light)', 22],
  ['AM', 'amplitude modulation', 23],
];

/** The formulas Lecture 1 uses: [formula, meaning, slide]. */
export const formulas: [string, string, number][] = [
  ['SNR(dB) = 10·log₁₀(P_signal / P_noise)', 'Link quality', 2],
  ['C = B·log₂(1 + SNR)', 'Shannon limit: maximum data rate', 6],
  ['f_d = v·f / c = v / λ', 'Doppler shift', 11],
  ['Free-space loss ∝ d² · f²', 'Loss grows with distance² and frequency²', 11],
  ['Path loss ∝ dⁿ (n ≈ 2–4)', 'Why multihop can save power', 14],
  ['Power density ∝ 1 / r²', 'Energy spreads over a sphere', 15],
  ['E = c × B', 'Field strengths in free space', 16],
  ['Power ∝ A²', 'Signal power and amplitude', 17],
  ['f = 1 / T', 'Frequency and period', 18],
  ['λ = c / f · λ (m) = 300 / f (MHz)', 'Frequency and wavelength', 20],
  ['s(t) = A·cos(2πft + φ)', 'The carrier', 21],
];

/** Slide 24, with the slide's own answers. `answer`/`unit` add a checked numeric input. */
export const quickCheck = [
  {
    n: '01', topic: 'Network organization', q: 'A laptop connects through a Wi-Fi access point. Which category is this?',
    choices: ['Infrastructure-based', 'Infrastructure-less (direct)', 'Multihop'], correct: 0,
    a: 'Infrastructure-based. The access point provides the access infrastructure.',
  },
  {
    n: '02', topic: 'Frequency', q: 'A signal completes 10 cycles in one second. What are f and T?',
    inputs: [{ label: 'f', unit: 'Hz', answer: 10 }, { label: 'T', unit: 's', answer: 0.1 }],
    a: 'f = 10 Hz and T = 1/f = 0.1 s.',
  },
  {
    n: '03', topic: 'Wavelength', q: 'If frequency doubles while wave speed stays constant, what happens to λ?',
    choices: ['λ doubles', 'λ halves', 'λ stays the same'], correct: 1,
    a: 'λ halves, because λ = c / f.',
  },
  {
    n: '04', topic: 'Modulation', q: 'Which changes in a carrier can represent information?',
    choices: ['Only amplitude', 'Amplitude, frequency or phase', 'Only the speed of the wave'], correct: 1,
    a: 'Amplitude, frequency or phase (ASK, FSK, PSK; QAM combines A and φ).',
  },
  {
    n: '05', topic: 'Challenge', q: 'A phone uses 2.4 GHz Wi-Fi. How long is a quarter-wave (λ/4) antenna? A bus at 100 km/h uses a 2 GHz link: estimate the Doppler shift.',
    inputs: [{ label: 'λ/4', unit: 'cm', answer: 3.125, tolerance: 0.03 }, { label: 'f_d', unit: 'Hz', answer: 185.2, tolerance: 0.03 }],
    a: 'λ = 3 × 10⁸ / 2.4 × 10⁹ = 12.5 cm, so λ/4 ≈ 3.1 cm. Doppler: v = 27.8 m/s, λ = 0.15 m, so f_d = v / λ ≈ 185 Hz.',
  },
];
