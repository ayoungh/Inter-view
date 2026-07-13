import { expect, test } from "@playwright/test";

test("interviewer console remains readable in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await page.getByLabel(/password/i).fill("playwright-secret");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText("New interview")).toBeVisible();

  const palette = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const section = getComputedStyle(document.querySelector("section")!);
    const title = getComputedStyle(document.querySelector("section button span.font-medium")!);
    const input = getComputedStyle(document.querySelector("input")!);
    return { bodyBackground: body.backgroundColor, sectionBackground: section.backgroundColor, sectionText: section.color, titleText: title.color, inputBackground: input.backgroundColor, inputText: input.color };
  });

  expect(palette.bodyBackground).not.toBe("rgb(255, 255, 255)");
  expect(palette.sectionBackground).not.toBe("rgb(255, 255, 255)");
  expect(palette.sectionText).not.toBe(palette.sectionBackground);
  expect(palette.titleText).not.toBe(palette.sectionBackground);
  expect(palette.inputText).not.toBe(palette.inputBackground);
});

test("creates a capability session and keeps AI evidence private", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel(/password/i).fill("playwright-secret");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText("New interview")).toBeVisible();
  await page.getByLabel(/candidate name/i).fill("Ada Lovelace");
  await page.getByRole("button", { name: /create interview link/i }).click();
  const candidateCode = page.locator("code").filter({ hasText: "/review/" });
  await expect(candidateCode).toBeVisible();
  const candidateUrl = await candidateCode.textContent();
  const reportUrl = await page.locator("code").filter({ hasText: "/report/" }).textContent();
  expect(candidateUrl).toBeTruthy(); expect(reportUrl).toBeTruthy();

  const candidate = await context.newPage();
  await candidate.goto(candidateUrl!);
  await expect(candidate.getByRole("button", { name: /files changed/i })).toBeVisible();
  await candidate.getByRole("button", { name: /comment on line/i }).first().click();
  await candidate.getByPlaceholder(/leave feedback/i).fill("This path appears to keep the wrong recency order.");
  await candidate.getByRole("button", { name: /start a review/i }).click();
  await expect(candidate.getByText(/draft comment/)).toBeVisible();
  await expect(candidate.locator("body")).not.toContainText("AI assessment");

  await page.goto(reportUrl!);
  if ((page.viewportSize()?.width ?? 1000) < 1050) {
    await page.getByRole("button", { name: "Toggle AI assessment" }).click();
  }
  await expect(page.getByText("AI assessment")).toBeVisible();
  await expect(page.getByText("This path appears to keep the wrong recency order.")).toBeVisible();
});
