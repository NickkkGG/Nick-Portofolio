import type { z } from 'zod';
import type { aboutSchema } from './schema';

export const about: z.input<typeof aboutSchema> = {
  headline: 'Every problem I run into becomes an idea.',
  paragraphs: [
    'When something breaks in my own workflow, I sketch the fix that same night.',
    'This site is the first idea I shipped: replace this text with your story.',
  ],
};
