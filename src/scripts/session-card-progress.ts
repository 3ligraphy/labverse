import { onPageLoad } from './page-load';
import { sessionProgress } from '../lib/session-progress';

function refreshSessionProgress() {
  document.querySelectorAll<HTMLElement>('[data-session-progress]').forEach((card) => {
    let saved: unknown = [];
    let available = true;
    try { saved = JSON.parse(localStorage.getItem(`lab-progress:${card.dataset.sessionProgress}`) ?? '[]'); }
    catch { available = false; }
    const ids: string[] = JSON.parse(card.dataset.taskIds ?? '[]');
    const { done, total, percent } = sessionProgress(ids, saved);
    if (!total) return;
    const bar = card.querySelector('progress')!;
    bar.value = done;
    bar.max = total;
    bar.hidden = !available;
    card.querySelector('[data-progress-label]')!.textContent = available
      ? `${done} of ${total} tasks complete · this browser`
      : 'Saved progress unavailable in this browser';
    card.querySelector('[data-progress-percent]')!.textContent = available ? `${percent}%` : '';
  });
}
onPageLoad(refreshSessionProgress);
window.addEventListener('pageshow', refreshSessionProgress);
window.addEventListener('storage', (event) => {
  if (!event.key || event.key.startsWith('lab-progress:')) refreshSessionProgress();
});
