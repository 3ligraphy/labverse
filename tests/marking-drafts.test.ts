// Admin → Marking drafts: what a TA typed and has not saved yet stays in the browser as a draft, and the row shows
// "Unsaved draft". After Save the draft must be gone for good: the page compares the form with the saved marks the
// way the server saves them (spaces at the end of a comment line are removed), so a saved group never shows a draft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMarks, cleanComment, draftDiffers, emptyDoc } from '../src/lib/marking/doc.ts';
import { MAX_COMMENT } from '../src/lib/marking/rubric.ts';

const admin = { role: 'admin' as const, email: 'lead@uni.test', name: 'Lead' };
// the form keeps what was typed, as text
const typed = { uc_actors: '1', uc_logic: '1,5', uc_mapping: '5', ad_reqs: '5', ad_flow: '2.5', ui_screens: '9', ar_pattern: '2', ar_impl: '2', ar_reason: '2' };

function saved(comment: string) {
  const d = emptyDoc();
  assert.equal(applyMarks(d, admin, 10, { scores: typed, comment }, []).ok, true);
  return d.marks['10'];
}

test('a comment with spaces at the end of a line is saved without them, and the saved form is no longer a draft', () => {
  const comment = 'Use case: the extend arrows are the wrong way round.  \nActivity: no end node.\t\n';
  const m = saved(comment);
  assert.equal(m.comment, 'Use case: the extend arrows are the wrong way round.\nActivity: no end node.');
  assert.equal(cleanComment(comment), m.comment, 'the page cleans the comment exactly like the server');
  // this is the form right after Save: the same text the TA typed (with the spaces), the same marks
  assert.equal(draftDiffers({ scores: typed, comment }, m), false);
});

test('a real change is still a draft: one mark, or the comment’s words', () => {
  const m = saved('Clear diagram.');
  assert.equal(draftDiffers({ scores: { ...typed, ar_reason: '1' }, comment: 'Clear diagram.' }, m), true);
  assert.equal(draftDiffers({ scores: typed, comment: 'Clear diagrams.' }, m), true);
  const { ar_reason: _gone, ...fewer } = typed;
  assert.equal(draftDiffers({ scores: fewer, comment: 'Clear diagram.' }, m), true, 'a mark that was cleared');
});

test('marks are compared as saved: "1,5" is 1.5, a mark over the maximum is the maximum', () => {
  const m = saved('');
  assert.equal(draftDiffers({ scores: { ...typed, uc_logic: '1.50' }, comment: '' }, m), false);
  assert.equal(draftDiffers({ scores: { ...typed, ui_screens: '12' }, comment: '   ' }, m), false, 'the screens are 9 at most');
});

test('a group with no saved marks: an empty form is no draft, anything typed is one', () => {
  assert.equal(draftDiffers({ scores: {}, comment: '  \n ' }, undefined), false);
  assert.equal(draftDiffers({ scores: { uc_actors: '1' }, comment: '' }, undefined), true);
  assert.equal(draftDiffers({ scores: {}, comment: 'Started.' }, undefined), true);
});

test('cleanComment: Windows line ends, trailing spaces per line, the length limit', () => {
  assert.equal(cleanComment('a \r\nb\t\r\n'), 'a\nb');
  assert.equal(cleanComment(null), '');
  assert.equal(cleanComment('x'.repeat(MAX_COMMENT + 50)).length, MAX_COMMENT);
});
