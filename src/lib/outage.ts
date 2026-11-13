/**
 * What students read while the course database cannot be reached. Sign-in, saving, attendance and hand-ins are off,
 * but every module and lab still opens and checks answers (practice mode). One place, so every page says the same
 * thing: the strip under the navbar (StatusStrip.astro), the sign-in page, the lab start card, check-in and the APIs.
 */
export const OUTAGE = {
  signIn: 'Sign-in is off right now because the course database is down. Your password was not checked. Try again later. You do not need to sign in to do a lab.',
  signUp: 'New accounts cannot be made right now because the course database is down. Try again later. You do not need an account to do a lab.',
  reset: 'Password requests cannot be sent right now because the course database is down. Try again later, or ask your TA in the lab.',
  lab: 'The course database is down. You can still run and check every exercise here, but nothing is saved and your attendance is not recorded. Tell your TA you are here.',
  checkin: 'Check-in is off right now because the course database is down. Tell your TA you are here. They record your attendance.',
  handIn: 'Hand-in is off right now because the course database is down. Keep your work, and hand it in when the “Saving is off” message is gone.',
  attendance: 'Attendance cannot be saved right now because the course database is down. Tell your TA you are here.',
} as const;
