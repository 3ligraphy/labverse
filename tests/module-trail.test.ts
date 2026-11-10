// Where a module sits on the site (breadcrumbs): All modules › Faculty › Year › Module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moduleTrail, yearId } from '../src/lib/platform/trail.ts';

const faculties = [{ slug: 'informatics-computer-science', name: 'Informatics & Computer Science' }, { slug: 'arts-humanities', name: 'Arts & Humanities' }];

test('a module for one year: All modules › faculty › year, each opening All modules there', () => {
  assert.deepEqual(moduleTrail({ faculty: 'informatics-computer-science', years: 'Prep year' }, faculties), [
    { label: 'All modules', href: '/modules' },
    { label: 'Informatics & Computer Science', href: '/modules?faculty=informatics-computer-science' },
    { label: 'Prep year', href: '/modules?faculty=informatics-computer-science#informatics-computer-science-prep-year' },
  ]);
  assert.equal(yearId('Prep year', 'informatics-computer-science'), 'informatics-computer-science-prep-year');
});

test('several years or every year: no year; every faculty: no faculty', () => {
  assert.equal(moduleTrail({ faculty: 'arts-humanities', years: 'Year 2, Year 3' }, faculties).length, 2);
  assert.equal(moduleTrail({ faculty: 'arts-humanities', years: '' }, faculties).length, 2);
  assert.deepEqual(moduleTrail({ faculty: 'all', years: 'Year 1' }, faculties), [{ label: 'All modules', href: '/modules' }]);
});
