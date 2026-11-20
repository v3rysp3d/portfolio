/**
 * Placeholder persona notes. Copy this file to `personaNotes.local.ts`, rename
 * the export to `PERSONA_NOTES`, and replace every value with your own. The
 * local file is git-ignored; this example is what a fresh clone and CI use.
 */
import type { PersonaNotes } from './personaNotes';

export const EXAMPLE_PERSONA_NOTES: PersonaNotes = {
  personality: 'A short, honest description of what you are like as a person and colleague.',
  motivation: 'What gives you energy at work.',
  workingWithMe: 'How teammates would describe working with you.',
  strengthsAndGrowth: 'A real strength, and the weakness you are actively working on.',
  interests: 'What you do outside of work.',
  waysOfWorking: [
    'How you approach an unfamiliar problem.',
    'How you think about quality and testing.',
    'How you handle disagreement.',
  ],
  lookingFor: 'The kind of team and role you want next.',
  notLookingFor: 'What would make a role a poor fit.',
  inFiveYears: 'Where you would like to be in five years.',
  whyHireMe: 'Your one-paragraph case for hiring you.',
  preparedAnswers: [
    {
      question: 'Tell me about yourself.',
      answer: 'Your two-or-three sentence introduction.',
    },
    {
      question: 'Tell me about a time you failed.',
      answer: 'A real example, what went wrong, and what you changed afterwards.',
    },
  ],
};
