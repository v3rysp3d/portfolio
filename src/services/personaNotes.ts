/**
 * Interview-only persona notes — personality, working style, what the candidate
 * is looking for, and prepared answers to common interview questions.
 *
 * This is reference material the AI interview stand-in draws on for *tone and
 * substance*; it is NOT shown anywhere on the public site and is never sent to
 * the browser. It exists so the persona can answer human, behavioural questions
 * ("what are you like to work with?", "tell me about a failure") in the
 * candidate's own voice instead of improvising. Keep everything truthful — the
 * model is told elsewhere never to invent beyond what it is given.
 *
 * The real notes are private, so they live in `personaNotes.local.ts`, which is
 * git-ignored. Copy `personaNotes.example.ts` to that name and fill it in. When
 * the local file is absent (a fresh clone, CI) the placeholder example is used.
 */
import { EXAMPLE_PERSONA_NOTES } from './personaNotes.example';

export interface PreparedAnswer {
  question: string;
  answer: string;
}

export interface PersonaNotes {
  personality: string;
  motivation: string;
  workingWithMe: string;
  strengthsAndGrowth: string;
  interests: string;
  waysOfWorking: string[];
  lookingFor: string;
  notLookingFor: string;
  inFiveYears: string;
  whyHireMe: string;
  preparedAnswers: PreparedAnswer[];
}

function loadPersonaNotes(): PersonaNotes {
  try {
    // Resolved at runtime on purpose: the file is optional, so a static import
    // would break the build on any machine that doesn't have it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const local = require('./personaNotes.local') as { PERSONA_NOTES: PersonaNotes };
    return local.PERSONA_NOTES;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw err;
    return EXAMPLE_PERSONA_NOTES;
  }
}

export const PERSONA_NOTES: PersonaNotes = loadPersonaNotes();
