/**
 * Builder labs that are now written as file labs (src/content/labs) and keep their builder progress key, so
 * sessions, check-ins, hand-ins and exercise progress carry on. The file lab wins everywhere: the builder copy
 * is hidden from lists and its address forwards to the file lab. Key → file lab id (its frontmatter
 * `trackingKey` must match; tests/lab03.test.ts checks it).
 */
export const FILE_LAB_KEYS: Readonly<Record<string, string>> = {
  'mobile-development--lab-03': 'lab-03',
};

export const claimedByFileLab = (key: string) => FILE_LAB_KEYS[key];
