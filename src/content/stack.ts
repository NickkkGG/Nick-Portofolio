import type { z } from 'zod';
import type { stackSchema } from './schema';

// The first three are real; the Tool slots wait for the rest of the list.
export const stack: z.input<typeof stackSchema> = [
  { name: 'JavaScript', category: 'Frontend' },
  { name: 'Python', category: 'Scripting' },
  { name: 'HTML', category: 'Frontend' },
  { name: 'Tool 04', category: '3D' },
  { name: 'Tool 05', category: '3D' },
  { name: 'Tool 06', category: 'Motion' },
  { name: 'Tool 07', category: 'Motion' },
  { name: 'Tool 08', category: 'Backend' },
  { name: 'Tool 09', category: 'Tooling' },
  { name: 'Tool 10', category: 'Tooling' },
];
