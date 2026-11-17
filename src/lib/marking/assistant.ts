/**
 * The grading assistant beside the marking form: the brief's rule for each criterion, and a checklist of common
 * Phase 1 mistakes. Ticking one suggests a deduction on its criterion and adds a ready sentence to the comment
 * (the TA can edit both). Generic wording only: nothing about a particular group.
 */
import type { CriterionId } from './rubric.ts';

export const RULES: Record<CriterionId, string> = {
  uc_actors: 'At least two actors, each drawn once.',
  uc_logic: 'One diagram, correct notation, include and extend used the right way. Wrong notation = 0.',
  uc_mapping: 'Every functional requirement (at least 5, login and sign-up not counted) has its use case.',
  ad_reqs: 'The flow covers every functional requirement.',
  ad_flow: 'Start node, end node, activities, decisions and a logical flow. −0.5 for each missing or wrong part.',
  ui_screens: '1 mark per screen: 9 screens, 3 per member (sign-in and registration not counted). Missing −1, incorrect −0.5.',
  ar_pattern: 'An architecture or design pattern is chosen and named (MVC, MVVM, Provider / Context…).',
  ar_impl: 'The pattern is applied in the project’s folder structure and code.',
  ar_reason: 'The choice is explained: why this pattern fits the app.',
};

export type CheckItem = { id: string; criterion: CriterionId; deduction: number; label: string; sentence: string };

export const CHECKLIST: CheckItem[] = [
  { id: 'uc-two-actors', criterion: 'uc_actors', deduction: 0.5, label: 'Fewer than two actors', sentence: 'The use case diagram needs at least two actors.' },
  { id: 'uc-actor-twice', criterion: 'uc_actors', deduction: 0.3, label: 'An actor is drawn more than once', sentence: 'Draw each actor only once in the use case diagram.' },
  { id: 'uc-one-diagram', criterion: 'uc_logic', deduction: 0.5, label: 'Split into several diagrams', sentence: 'The use case diagram should be one diagram with all actors and use cases.' },
  { id: 'uc-include-extend', criterion: 'uc_logic', deduction: 0.5, label: 'Include / extend wrong or reversed', sentence: 'Check the include and extend arrows: extend points from the optional use case to the base use case.' },
  { id: 'uc-merge-crud', criterion: 'uc_mapping', deduction: 0.5, label: 'Add, edit and delete are separate requirements', sentence: 'Combine add, edit and delete into one requirement, for example “Manage tasks”, in the requirements and the diagram.' },
  { id: 'uc-missing-req', criterion: 'uc_mapping', deduction: 1, label: 'A requirement has no use case', sentence: 'Every functional requirement needs its use case in the diagram.' },
  { id: 'ad-split', criterion: 'ad_flow', deduction: 0.5, label: 'Split into several diagrams', sentence: 'The activity diagram should be one diagram with every flow of the app.' },
  { id: 'ad-start-end', criterion: 'ad_flow', deduction: 0.5, label: 'Missing start / end node or decision', sentence: 'The activity diagram needs a start node, an end node and its decisions.' },
  { id: 'ad-unreadable', criterion: 'ad_flow', deduction: 0.3, label: 'Messy or hard to read', sentence: 'Make the activity diagram clearer and easier to read.' },
  { id: 'ad-missing-req', criterion: 'ad_reqs', deduction: 1, label: 'A requirement is missing from the flow', sentence: 'Add every functional requirement to the activity diagram.' },
  { id: 'ui-missing', criterion: 'ui_screens', deduction: 1, label: 'A screen is missing', sentence: 'Some of the 9 screens are missing: each member implements 3 screens.' },
  { id: 'ui-incorrect', criterion: 'ui_screens', deduction: 0.5, label: 'A screen is incorrect', sentence: 'Some screens do not match the requirements.' },
  { id: 'ui-generated', criterion: 'ui_screens', deduction: 1, label: 'UI looks generated, no own design', sentence: 'The UI looks generated with no design of your own: AI may help with code, but redesign the screens yourselves.' },
  { id: 'ui-main-empty', criterion: 'ui_screens', deduction: 0, label: 'Main branch empty (work on another branch)', sentence: 'The main branch of the repository is empty: merge your work into main before the next phase.' },
  { id: 'ar-none', criterion: 'ar_pattern', deduction: 2, label: 'No pattern chosen', sentence: 'Choose an architecture or design pattern and name it in the report.' },
  { id: 'ar-not-in-code', criterion: 'ar_impl', deduction: 1, label: 'Pattern named but not in the code', sentence: 'The report names a pattern, but the code is organised differently: the folders must follow the pattern you chose.' },
  { id: 'ar-reason-short', criterion: 'ar_reason', deduction: 0.5, label: 'Reasoning too short', sentence: 'Explain in more detail why you chose this architecture.' },
];
