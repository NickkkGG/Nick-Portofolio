import type { z } from 'zod';
import type { projectsSchema } from './schema';

// Add a real project by switching an entry to `status: 'live'` with a `summary`
// and a `media` file under public/projects/<slug>/ (spec §6).
export const projects: z.input<typeof projectsSchema> = [
  { slug: 'project-01', title: 'Project 01', status: 'no-signal', tags: [] },
  { slug: 'project-02', title: 'Project 02', status: 'no-signal', tags: [] },
  { slug: 'project-03', title: 'Project 03', status: 'no-signal', tags: [] },
  { slug: 'project-04', title: 'Project 04', status: 'no-signal', tags: [] },
  { slug: 'project-05', title: 'Project 05', status: 'no-signal', tags: [] },
  { slug: 'project-06', title: 'Project 06', status: 'no-signal', tags: [] },
];
