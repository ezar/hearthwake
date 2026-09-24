import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

async function onboard(page: Page) {
  await page.goto('./?mock');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'All quiet' })).toBeVisible();
}

test('first run, wake by camera, talk and see the soul', async ({ page }) => {
  await onboard(page);

  await page.getByRole('link', { name: 'Wake something' }).click();
  await expect(page.getByText('A sliding door?')).toBeVisible();
  await page.getByRole('button', { name: 'Wake it' }).click();
  await expect(page.getByRole('heading', { name: 'Something stirs…' })).toBeVisible();

  await expect(page.getByText("Hello, I'm Flibber!")).toBeVisible();
  const sound = page.getByRole('button', { name: 'Speak replies aloud' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page.getByLabel('Message to Flibber').fill('What do you do all day?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('What do you do all day?')).toBeVisible();
  await expect(page.getByText('Aha! Every time I slide open, a little adventure begins.')).toBeVisible();

  await page.getByRole('link', { name: /Flibber/ }).click();
  await expect(page.getByRole('heading', { name: 'Flibber' })).toBeVisible();
  await expect(page.getByText('timely')).toBeVisible();

  // Souls survive a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Flibber' })).toBeVisible();
});

test('wake from a description, then let it sleep', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Describe it instead' }).click();
  await page.getByLabel('What is it?').fill('teapot');
  await page.getByLabel('What does it look like?').fill('Round and blue.');
  await page.getByRole('button', { name: 'Wake it' }).click();
  await expect(page.getByRole('button', { name: /Hold to talk|Send/ }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Back to your hearth' }).click();
  await expect(page.getByRole('heading', { name: "Who's awake" })).toBeVisible();
  await expect(page.getByText('One thing in your home has something to say.')).toBeVisible();

  await page.getByRole('link', { name: /Pip/ }).click();
  await expect(page.getByText('Oh! Hello there. I am Pip')).toBeVisible();
  await page.getByRole('link', { name: /Pip/ }).click();
  await page.getByRole('button', { name: 'Let it sleep for good' }).click();
  await page.getByRole('button', { name: 'Let it sleep', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All quiet' })).toBeVisible();
});

test('settings turn speech off and link to the test harness', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  const speak = page.getByRole('switch', { name: /Speak replies aloud/ });
  await expect(speak).toBeChecked();
  await speak.click();
  await expect(speak).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('switch', { name: /Speak replies aloud/ })).not.toBeChecked();
  await expect(page.getByRole('link', { name: /Test harness/ })).toHaveAttribute('href', '/hearthwake/poc/');
});

test('unsupported browsers get an explanation', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: "This browser can't wake things up yet." })).toBeVisible();
});

test('the onboarding explains the experiment, and Settings shows it again', async ({ page }) => {
  await page.goto('./?mock');
  await expect(page.getByRole('heading', { name: 'The things in your home wake up.' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Talk to them. They remember.' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'An experiment in AI on your device.' })).toBeVisible();
  await page.getByRole('button', { name: "Let's begin" }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'All quiet' })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: /About this experiment/ }).click();
  await expect(page.getByRole('heading', { name: 'The things in your home wake up.' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('a thing that already woke up is recognised and welcomed back', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Wake something' }).click();
  await page.getByRole('button', { name: 'Wake it' }).click();
  await expect(page.getByText("Hello, I'm Flibber!")).toBeVisible();
  await page.getByRole('button', { name: 'Back to your hearth' }).click();

  await page.getByRole('link', { name: 'Wake something' }).click();
  await page.getByRole('button', { name: 'Wake it' }).click();
  await expect(page.getByRole('heading', { name: 'Is this Flibber?' })).toBeVisible();
  await page.getByRole('button', { name: "Yes, it's Flibber" }).click();
  await expect(page.getByText('Oh, you are back! I kept your seat warm.')).toBeVisible();

  // Saying it is someone new wakes a second soul instead.
  await page.getByRole('button', { name: 'Back to your hearth' }).click();
  await page.getByRole('link', { name: 'Wake something' }).click();
  await page.getByRole('button', { name: 'Wake it' }).click();
  await page.getByRole('button', { name: "No, it's someone new" }).click();
  await expect(page.getByText("Hello, I'm Flibber!")).toBeVisible();
  await page.getByRole('button', { name: 'Back to your hearth' }).click();
  await expect(page.getByText('Two things in your home have something to say.')).toBeVisible();
});
