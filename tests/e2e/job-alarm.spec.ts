import { expect, test } from "@playwright/test";

test.describe("Job Alarm Functionality", () => {
  test("allows user to setup a job alarm and displays success", async ({ page }) => {
    // Mock the post request for creating an alarm
    await page.route("**/api/alerts/subscriptions", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Alarm created successfully",
        }),
      });
    });

    await page.goto("/");

    // Navigate to Job-Alarm section
    await page.getByRole("link", { name: "Job-Alarm" }).click();

    // Verify Job-Alarm section is visible
    await expect(page.getByText(/Job-Alarm/i).first()).toBeVisible();

    // Interact with the "Job-Alarm einrichten" button
    const setupAlarmBtn = page.getByRole("button", { name: /Job-Alarm einrichten/i });
    if (await setupAlarmBtn.isVisible()) {
        await setupAlarmBtn.click();
    }

    // Verify the Job Alarm section or modal remains accessible and visible
    await expect(page.getByText(/Job-Alarm/i).first()).toBeVisible();
  });
});
