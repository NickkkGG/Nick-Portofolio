import { describe, expect, it } from 'vitest';
import { content } from './index';
import { channelLabel, contactSchema, padProjects, type Project, projectSchema, projectsSchema } from './schema';

function noSignal(n: number): Project {
  const id = String(n).padStart(2, '0');
  return { slug: `p-${id}`, title: `P ${id}`, status: 'no-signal', tags: [] };
}

describe('content', () => {
  it('dummy content parses and has 6 projects', () => {
    expect(content.projects).toHaveLength(6);
    expect(content.stack).toHaveLength(10);
    expect(content.contact.map((c) => c.label)).toEqual(['EMAIL', 'GITHUB', 'LINKEDIN', 'CV']);
  });

  it('a live project without media is rejected and names the field', () => {
    const result = projectSchema.safeParse({ slug: 'x', title: 'X', status: 'live', summary: 's' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('media'))).toBe(true);
  });

  it('duplicate project slugs are rejected', () => {
    const result = projectsSchema.safeParse([
      { slug: 'a', title: 'A', status: 'no-signal' },
      { slug: 'a', title: 'B', status: 'no-signal' },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join(' ')).toContain('duplicate slug "a"');
  });

  it('padProjects fills up to 6 with no-signal slots', () => {
    const result = padProjects([noSignal(1), noSignal(2), noSignal(3)]);
    expect(result).toHaveLength(6);
    expect(result[3]).toEqual({ slug: 'no-signal-04', title: 'NO SIGNAL', status: 'no-signal', tags: [] });
  });

  it('padProjects keeps longer lists unchanged', () => {
    const input = Array.from({ length: 8 }, (_, i) => noSignal(i + 1));
    expect(padProjects(input)).toEqual(input);
  });

  it('channelLabel uses two digits', () => {
    expect(channelLabel(0)).toBe('CH-01');
    expect(channelLabel(9)).toBe('CH-10');
  });

  it('contact href must be mailto or https', () => {
    expect(contactSchema.safeParse([{ label: 'X', href: 'http://x.com' }]).success).toBe(false);
  });
});
