import type { z } from 'zod';
import type { contactSchema } from './schema';

// The CV link is a placeholder still, until there is a CV to point at.
export const contact: z.input<typeof contactSchema> = [
  { label: 'EMAIL', href: 'mailto:nickknelsoon30@icloud.com' },
  { label: 'GITHUB', href: 'https://github.com/NickkkGG' },
  { label: 'LINKEDIN', href: 'https://www.linkedin.com/in/nicknelsons' },
  { label: 'CV', href: 'https://example.com/cv.pdf' },
];
