import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play } from './helpers';

const HEADLINE = 'Every problem I run into becomes an idea.';

test.describe('chapter texts', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('the room shows name and role at the start and after the loop', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    for (const p of [0.0005, 0.995]) {
      await jumpTo(page, p);
      await expect(texts, `p=${p}`).toContainText('Your Name');
      await expect(texts, `p=${p}`).toContainText('Creative Developer');
    }
  });

  test('every chapter text stays on screen, clear of the nav', async ({ page }) => {
    const cases: [number, string][] = [
      [0.03, 'Your Name'],
      [0.311, 'Project 01'],
      [0.704, HEADLINE],
      [0.8, 'Tool 01'],
      [0.885, 'pick a tape'],
    ];
    const nav = await page.getByRole('navigation').boundingBox();
    for (const [p, text] of cases) {
      await jumpTo(page, p);
      const item = page.getByTestId('chapter-texts').getByText(text);
      await expect(item, `p=${p}`).toBeInViewport({ ratio: 1 });
      const box = await item.boundingBox();
      expect(box!.y, `p=${p}`).toBeGreaterThan(nav!.y + nav!.height);
    }
  });

  test('the spiral names the focused project', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    await jumpTo(page, 0.311);
    await expect(texts).toContainText('01 / 06');
    await expect(texts).toContainText('Project 01');
    await jumpTo(page, 0.398);
    await expect(texts).toContainText('03 / 06');
    await expect(texts).toContainText('Project 03');
  });

  test('the about headline waits for the bulb', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    await jumpTo(page, 0.64);
    await expect(texts.getByText(HEADLINE)).toHaveCount(0);
    await jumpTo(page, 0.704);
    await expect(texts.getByText(HEADLINE)).toBeVisible();
  });
});

test('content is in the server HTML', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain(HEADLINE);
  expect(html).toContain('Project 06');
  expect(html).toContain('Tool 10');
});
