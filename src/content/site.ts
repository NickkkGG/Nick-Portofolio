import type { z } from 'zod';
import type { siteSchema } from './schema';

export const site: z.input<typeof siteSchema> = {
  name: 'Your Name',
  role: 'Creative Developer',
  tagline: "Got a problem? I've got an idea.",
};
