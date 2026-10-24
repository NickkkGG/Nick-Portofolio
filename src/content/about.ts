import type { z } from 'zod';
import type { aboutSchema } from './schema';
import { site } from './site';

// Dummy slides: replace the [bracketed] parts with your own story before it goes live.
export const about: z.input<typeof aboutSchema> = {
  slides: [
    {
      title: `Hi, I'm ${site.name}.`,
      body: 'Information Systems student, [semester 5] at [campus]. I design and build things for the web.',
    },
    {
      title: 'Problems become ideas.',
      body: "When something around me doesn't work, I ask why, who else feels it, and what would make it better.",
    },
    { title: 'I learn by building.', body: '[Something I taught myself, and how.]' },
    { title: 'Better together.', body: '[In a campus project or organization], I [role], and we [result].' },
    { title: 'Off screen.', body: '[A hobby that feeds ideas.]' },
    { title: 'Next.', body: 'Looking for a place to turn ideas into apps people actually use.' },
  ],
  motto: 'Every problem I run into becomes an idea.',
};
