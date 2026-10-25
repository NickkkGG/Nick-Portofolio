import type { z } from 'zod';
import type { siteSchema } from './schema';

const name = 'Nick Nelson';

export const site: z.input<typeof siteSchema> = {
  name,
  greeting: `Hi, I'm ${name}`,
  role: 'Creative Developer',
  tagline: "Got a problem? I've got an idea.",
  stackTitle: "Tools I've picked up along the way",
};
