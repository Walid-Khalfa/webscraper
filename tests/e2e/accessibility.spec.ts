import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage satisfies core accessibility checks", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /stellen finden/i })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const blockingViolations = accessibilityScanResults.violations.filter((violation) =>
    ["critical", "serious"].includes(String(violation.impact || "")),
  );

  expect(
    blockingViolations,
    JSON.stringify(
      blockingViolations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target),
      })),
      null,
      2,
    ),
  ).toEqual([]);
});
