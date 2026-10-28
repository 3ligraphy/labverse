// The shared rules for what a student types: name, student ID and group.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanGroup, cleanName, cleanStudentId, groupError, looseGroup, nameError, studentIdError } from '../src/lib/identity.ts';

test('student ID: 5–9 digits; a name typed in the ID box is called out', () => {
  assert.equal(studentIdError('241995'), null);
  assert.equal(studentIdError(cleanStudentId(' 24 1995 ')), null);
  assert.equal(studentIdError('123456789'), null);
  assert.match(studentIdError('Mariam Ahmed') ?? '', /did you type your name here/);
  assert.match(studentIdError('23CS0001') ?? '', /only numbers/);
  assert.match(studentIdError('1234') ?? '', /5–9 digits/);
  assert.match(studentIdError('1234567890') ?? '', /5–9 digits/);
  assert.match(studentIdError('') ?? '', /Type your student ID/);
});

test('name: letters only; digits get their own message', () => {
  assert.equal(nameError(cleanName('  Mariam   Ahmed ')), null);
  assert.equal(nameError('مريم أحمد'), null);
  assert.equal(nameError("O'Neil-Smith"), null);
  assert.match(nameError('241995') ?? '', /can’t contain numbers/);
  assert.match(nameError('M') ?? '', /full name/);
});

test('group: short code with a number, normalised to upper case', () => {
  assert.equal(cleanGroup('12'), 'G12');
  assert.equal(cleanGroup(' g 7 '), 'G7');
  assert.equal(cleanGroup('Group 3'), 'G3');
  assert.equal(cleanGroup('a3'), 'A3');
  for (const ok of ['G12', 'A3', 'G1']) assert.equal(groupError(ok), null, ok);
  for (const bad of ['Ahmed', 'G', '', 'G12345', 'ABCD1']) assert.ok(groupError(cleanGroup(bad)), bad);
});

test('lab group: optional free text, tidied when it is a code with a number', () => {
  assert.equal(looseGroup(''), '');
  assert.equal(looseGroup('  '), '');
  assert.equal(looseGroup('—'), '');
  assert.equal(looseGroup('12'), 'G12');
  assert.equal(looseGroup('group 7'), 'G7');
  assert.equal(looseGroup('Section A  morning'), 'Section A morning');
  assert.equal(looseGroup('x'.repeat(40)).length, 20);
});
