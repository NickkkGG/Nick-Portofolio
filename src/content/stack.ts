import type { z } from 'zod';
import type { stackSchema } from './schema';

// The languages and tools the owner has learned or used; the logos are on the way.
export const stack: z.input<typeof stackSchema> = [
  { name: 'HTML' },
  { name: 'CSS' },
  { name: 'JavaScript' },
  { name: 'Python' },
  { name: 'Java' },
  { name: 'Vercel' },
  { name: 'Luau' },
];
