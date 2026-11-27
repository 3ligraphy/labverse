/**
 * The id the reading tracker records for an element it watches: the task number (`data-task`), or, in a legacy
 * exercise-only lab, the exercise id (`data-exercise="…"`). Builder C++ and AI blocks carry an empty
 * `data-exercise` as a gate marker: they have no id of their own, so they are not recorded (the server refuses a
 * batch with an unknown task).
 */
export const readingId = (dataset: { task?: string; exercise?: string }): string | null => dataset.task || dataset.exercise || null;
