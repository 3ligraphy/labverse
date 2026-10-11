/**
 * IDEA DETAILS — a short description and the feature list of one idea, read from the text of a group's proposal
 * (the lines src/scripts/doc-text.ts extracts). Used by the "Details" window on /admin/project/[id]/feedback.
 * The idea's section runs from the line that names it to the line that names the next idea. Pure functions only
 * (tests/idea-details.test.ts).
 */
import { labelledIdea, normName } from './groups.ts';

export type Feature = { section: string; title: string; text: string };
export type IdeaDetails = { description: string; features: Feature[] };

const MAX_DESCRIPTION = 700;
const MAX_FEATURES = 40;

const PAGE_MARK = /^(?:page\s*\|?\s*\d+(?:\s*(?:of|\/)\s*\d+)?|\d+\s*\|\s*page)$/i;
/** "• | Account: …", "| Account: …", "- Account", "✓ Account". */
const BULLET = /^(?:[•\-*▪◦●○■□➢►–✓✔]\s*\|?\s*|\|\s*)(.+)$/;
/** "2.", "A.", "b)", "iv." before a heading. */
const NUMBERING = /^(?:\d{1,2}(?:\.\d{1,2})*|[A-Ha-h]|[ivx]{1,4})[.)]\s+/;
const FEATURES = /\b(?:features?|functionalit(?:y|ies)|functional\s+requirements|what\s+(?:the\s+)?app\s+(?:does|offers))\b/i;
/** Sections after the features that are not features. */
const NOT_FEATURES = /\b(?:technical|architecture|tech\s*stack|technolog|tools?\s+(?:used|and)|scope|deliverables|timeline|schedule|references|conclusion|team|contribution|members|budget|risks?)\b/i;
/** Paragraphs that describe the idea best, when the file labels one. */
const SUMMARY = /^(?:core\s+)?(?:solution(?:\s+statement)?|overview|description|summary|about(?:\s+the\s+app)?|concept|idea|the\s+app|app\s+description)\s*:\s*/i;
/** "Core Solution Statement: …" starts a new paragraph (a wrapped line doesn't). */
const LABEL = /^[A-Z][\w &/'’()-]{2,40}:\s+\S/;

type Line = { kind: 'heading' | 'bullet' | 'prose'; text: string };

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

function classify(line: string): Line {
  const bullet = BULLET.exec(line);
  if (bullet) return { kind: 'bullet', text: bullet[1].trim() };
  const numbered = NUMBERING.test(line);
  const rest = line.replace(NUMBERING, '');
  // "1. Login: users sign in with their university email" is a numbered feature, not a heading
  if (numbered && /^[^:]{2,60}:\s+\S+(?:\s+\S+){2,}/.test(rest)) return { kind: 'bullet', text: rest };
  const short = line.length <= 90 && !/[.,;]$/.test(line);
  if (short && (numbered || (line.endsWith(':') && words(line) <= 6) || /^(?:key\s+|main\s+|core\s+|app\s+)?features?:?$/i.test(line))) {
    return { kind: 'heading', text: rest.replace(/:$/, '').trim() };
  }
  return { kind: 'prose', text: line };
}

/** Cuts a long text at the last sentence end before `max` characters. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

/** Where the idea's section starts: the line naming it (a labelled line first, then a short line containing it). */
function findStart(lines: readonly string[], idea: string): number {
  const want = normName(idea);
  if (!want) return -1;
  const named = (l: string) => normName(l).includes(want);
  const labelled = lines.findIndex((l) => { const i = labelledIdea(l); return Boolean(i && normName(i) === want) || Boolean(i && named(l)); });
  if (labelled >= 0) return labelled;
  return lines.findIndex((l) => named(l) && l.length <= want.length + 60);
}

/**
 * The description and features of `idea` in a proposal's lines, or null when the file never names it.
 * Description: the paragraph labelled as the solution/overview if there is one, else the first paragraphs.
 * Features: the bullets after a "Features" heading (grouped by the sub-headings above them), or every bullet in
 * the idea's section when it has no such heading.
 */
export function ideaDetails(rawLines: readonly string[], idea: string): IdeaDetails | null {
  const lines = rawLines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !PAGE_MARK.test(l));
  const start = findStart(lines, idea);
  if (start < 0) return null;
  const want = normName(idea);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const other = labelledIdea(lines[i]);
    if (other && normName(other) !== want) { end = i; break; }
  }
  // A line like "Idea 1 Description: X" is the heading; anything after the name on a plain line is prose.
  const body = lines.slice(start + 1, end).map(classify);

  const paragraphs: string[] = [];
  const allBullets: Feature[] = [];
  const features: Feature[] = [];
  let inFeatures = false;
  let sawFeatures = false;
  let section = '';
  let last: Feature | null = null; // the bullet that wrapped lines continue
  let para: string[] | null = null;

  const endPara = () => { if (para?.length) paragraphs.push(para.join(' ')); para = null; };
  const toFeature = (text: string): Feature => {
    const m = /^([^:]{2,60}):\s*(.*)$/.exec(text);
    return m ? { section, title: m[1].trim(), text: m[2].trim() } : { section, title: text, text: '' };
  };

  for (const line of body) {
    if (line.kind === 'heading') {
      endPara();
      last = null;
      if (FEATURES.test(line.text) && !NOT_FEATURES.test(line.text)) {
        inFeatures = sawFeatures = true;
        section = /^(?:key\s+|main\s+|core\s+|app\s+)?features?$/i.test(line.text) ? '' : line.text;
      } else if (NOT_FEATURES.test(line.text)) {
        inFeatures = false;
      } else if (inFeatures) {
        section = line.text;
      }
      continue;
    }
    if (line.kind === 'bullet') {
      endPara();
      last = toFeature(line.text);
      allBullets.push(last);
      if (inFeatures) features.push(last);
      continue;
    }
    // prose: continues the bullet above it (wrapped text), unless it starts a labelled paragraph
    if (last && !LABEL.test(line.text)) {
      if (last.text) last.text += ` ${line.text}`; else last.title += ` ${line.text}`;
      continue;
    }
    last = null;
    if (sawFeatures) continue; // prose after the features is not the description
    if (LABEL.test(line.text)) endPara();
    (para ??= []).push(line.text);
  }
  endPara();

  const summary = paragraphs.find((p) => SUMMARY.test(p));
  const description = clip((summary ? summary.replace(SUMMARY, '') : paragraphs.slice(0, 2).join(' ')).trim(), MAX_DESCRIPTION);
  const list = (sawFeatures ? features : allBullets).slice(0, MAX_FEATURES)
    .map((f) => ({ ...f, title: clip(f.title, 120), text: clip(f.text, 400) }));
  return { description, features: list };
}
