/**
 * COURSE-LEVEL SETTINGS
 * Course info, teaching team and assessment live in src/content/data/site.yaml
 * (editable from the admin CMS). Navigation is defined here.
 */
import { parse } from 'yaml';
import { siteSchema } from './content/schemas';
import siteYaml from './content/data/site.yaml?raw';

const site = siteSchema.parse(parse(siteYaml));

/** Course name, codes, overview copy. */
export const course = site.course;

/** Teaching team — shown on the home page, in the footer and in Lab 01. */
export const team = site.team;

/** Assessment split for the module. */
export const assessment = site.assessment;

/** The platform that hosts every module (the course below is its built-in module). */
export const platform = { name: 'BUENOVA', tagline: 'Interactive courses platform' };

/** Sections of the built-in course, shown in the nav once a student is inside it. */
export const nav = [
  { label: 'Overview', href: '/mobile-development' },
  { label: 'Labs', href: '/mobile-development/labs' },
  { label: 'Coursework', href: '/mobile-development/coursework' },
  { label: 'Project', href: '/mobile-development/project' },
  { label: 'Commands', href: '/mobile-development/commands' },
  { label: 'Tools', href: '/mobile-development/tools' },
  { label: 'Setup', href: '/mobile-development/setup' },
  { label: 'Resources', href: '/mobile-development/resources' },
];

export const secondaryNav = [
  { label: 'Troubleshooting', href: '/mobile-development/troubleshooting' },
  { label: 'Extra Learning', href: '/mobile-development/extra' },
];
