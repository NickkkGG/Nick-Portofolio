import type { z } from 'zod';
import type { contactSchema } from './schema';

export const contact: z.input<typeof contactSchema> = [
  { label: 'EMAIL', href: 'mailto:hello@example.com' },
  { label: 'GITHUB', href: 'https://github.com/example' },
  { label: 'LINKEDIN', href: 'https://www.linkedin.com/in/example' },
  { label: 'CV', href: 'https://example.com/cv.pdf' },
];
