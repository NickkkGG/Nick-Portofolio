import type { z } from 'zod';
import type { stackSchema } from './schema';

export const stack: z.input<typeof stackSchema> = [
  { name: 'Tool 01', category: 'Frontend' },
  { name: 'Tool 02', category: 'Frontend' },
  { name: 'Tool 03', category: '3D' },
  { name: 'Tool 04', category: '3D' },
  { name: 'Tool 05', category: 'Motion' },
  { name: 'Tool 06', category: 'Motion' },
  { name: 'Tool 07', category: 'Backend' },
  { name: 'Tool 08', category: 'Backend' },
  { name: 'Tool 09', category: 'Tooling' },
  { name: 'Tool 10', category: 'Tooling' },
];
