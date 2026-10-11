// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ideaDetails } from '../src/lib/project-files/idea-details.ts';

/* "Idea n Description: X", prose, then "Features:" with " | " bullets whose text wraps onto the next lines. */
const lostFound = [
  'Mobile Application Development', 'Contribution Table:', 'Name | ID', 'Student One | 240001', 'Student Two | 240002', 'Ideas Proposed',
  'Idea 1 Description: Campus Lost and Found',
  'Campus Lost and Found is a phone app for students. It is useful for locating items that were',
  'misplaced. It also assists others in recovering their belongings.',
  'Features:',
  '| Account: Set up your account. Log on using your school/uni email. Access your profile',
  'page. Put in your list of posts. Once you are done, click Save.',
  '| Post an Item: Add a photo to your post. Then pick a catchy name that is easy to understand.',
  'Immediately following the title, type the description.',
  '| Map view: Click the map view and examine the pins around the campus.',
  'Idea 2 Description: Fitness and Path Tracker',
  'Take advantage of this app when away from home. It can be used while jogging, walking, or',
  'biking.',
  'Features:',
  '| Goals: Decide on a number of steps to do each day.',
  '| Background running: It can keep working while you are not in the app.',
];

/* "Project Proposal: X" sections: numbered headings, problem bullets, a solution paragraph, lettered feature groups. */
const gym = [
  'Page | 1', 'Faculty of Informatics and Computer Science', 'Name | ID | Group', 'Student One | 240001 | SE A3', 'Page | 2',
  'Project Proposal: Gym Connect',
  '1. Project Overview & Problem Statement',
  'Gym-goers frequently face two distinct friction points during workout sessions:',
  '• | Equipment Bottlenecks: Crowded gym floors lead to long wait times for key equipment',
  '(squat racks, bench presses, cable machines), causing disjointed workouts and wasted time.',
  'Core Solution Statement: Gym Connect solves both problems by providing an integrated',
  'mobile platform that merges live equipment status updates with on-demand spotting.',
  '2. User Mobile App Features',
  'A. Equipment & Routine Management ("GymFlow")',
  '• | Interactive Gym Floor Grid: A real-time layout of the gym floor showing equipment status.',
  '• | Built-in Rest & Queue Timer: Integrated set timer with haptic feedback (expo-haptics)',
  'upon rest period completion.',
  'Page | 3',
  'B. In-Gym Social & Spotting System ("Spotter")',
  '• | Instant "Spot Me" Broadcast: Broadcast a quick 2-minute spot request.',
  '3. Admin Panel Features (Web Dashboard)',
  '• | Equipment Inventory Control: Add, remove, or update gym machines.',
  '4. Technical Architecture & Tech Stack',
  '• | Mobile Frontend: React Native with Expo.',
  'Page | 5',
  'Project Proposal: Recycling Marketplace Platform',
  '1. Project Overview & Problem Statement',
  'Core Solution Statement: The Recycling Marketplace Platform connects households and businesses with recycling collectors.',
  '2. User Features (Households and Businesses)',
  '• | Add Recyclable Materials: Create a listing by selecting the material category.',
];

test('ideaDetails reads the description and wrapped feature bullets of each idea', () => {
  const one = ideaDetails(lostFound, 'Campus Lost and Found')!;
  assert.equal(one.description, 'Campus Lost and Found is a phone app for students. It is useful for locating items that were misplaced. It also assists others in recovering their belongings.');
  assert.deepEqual(one.features.map((f) => f.title), ['Account', 'Post an Item', 'Map view']);
  assert.equal(one.features[0].text, 'Set up your account. Log on using your school/uni email. Access your profile page. Put in your list of posts. Once you are done, click Save.');
  assert.match(one.features[1].text, /understand\. Immediately following the title/);

  const two = ideaDetails(lostFound, 'Fitness and Path Tracker')!;
  assert.equal(two.description, 'Take advantage of this app when away from home. It can be used while jogging, walking, or biking.');
  assert.deepEqual(two.features.map((f) => f.title), ['Goals', 'Background running']);
});

test('ideaDetails prefers the solution statement and groups features under their sub-headings', () => {
  const gc = ideaDetails(gym, 'Gym Connect')!;
  assert.equal(gc.description, 'Gym Connect solves both problems by providing an integrated mobile platform that merges live equipment status updates with on-demand spotting.');
  assert.deepEqual(gc.features.map((f) => [f.section, f.title]), [
    ['Equipment & Routine Management ("GymFlow")', 'Interactive Gym Floor Grid'],
    ['Equipment & Routine Management ("GymFlow")', 'Built-in Rest & Queue Timer'],
    ['In-Gym Social & Spotting System ("Spotter")', 'Instant "Spot Me" Broadcast'],
    ['Admin Panel Features (Web Dashboard)', 'Equipment Inventory Control'],
  ]);
  assert.match(gc.features[1].text, /\(expo-haptics\) upon rest period completion\.$/);

  const rm = ideaDetails(gym, 'Recycling Marketplace Platform')!;
  assert.match(rm.description, /^The Recycling Marketplace Platform connects/);
  assert.deepEqual(rm.features.map((f) => f.title), ['Add Recyclable Materials']);
});

test('ideaDetails without a features heading lists every bullet; unknown ideas give null', () => {
  const d = ideaDetails(['Idea 1: StudyBuddy', 'A planner that matches classmates for group study.', '- Shared calendar', '- Study rooms: book a room on campus'], 'StudyBuddy')!;
  assert.equal(d.description, 'A planner that matches classmates for group study.');
  assert.deepEqual(d.features.map((f) => [f.title, f.text]), [['Shared calendar', ''], ['Study rooms', 'book a room on campus']]);
  assert.equal(ideaDetails(lostFound, 'KinoLog'), null);
});

test('ideaDetails treats "1. Login: …" as a numbered feature, not a heading', () => {
  const d = ideaDetails(['Idea 1: CookBook', 'Recipes you can cook tonight.', 'Features:', '1. Login: users sign in with their email', '2. Search: find recipes by ingredient'], 'CookBook')!;
  assert.deepEqual(d.features.map((f) => f.title), ['Login', 'Search']);
});
