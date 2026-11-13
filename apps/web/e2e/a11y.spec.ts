import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe("@cmp/web WCAG 2.2 AA accessibility", () => {
  test("passes axe-core WCAG 2.2 AA audit in light and dark themes", async ({
    page,
  }) => {
    await page.goto("/");

    const lightResults = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(lightResults.violations).toEqual([]);

    const themeToggle = page.getByRole("button", {
      name: /Switch to Dark Theme/i,
    });
    await themeToggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle).toHaveAttribute("aria-pressed", "true");

    const darkResults = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(darkResults.violations).toEqual([]);
  });

  test("supports keyboard navigation and visible focus indicators", async ({
    page,
  }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    const focusOutline = await skipLink.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
      };
    });
    expect(focusOutline.outlineStyle).not.toBe("none");
    expect(focusOutline.outlineWidth).toBeGreaterThan(0);

    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("announces interactive pin scarcity and form state changes accessibly", async ({
    page,
  }) => {
    await page.goto("/");

    const pinStatus = page.locator("#pin-status");
    await expect(pinStatus).toHaveText("2 of 3 focus items pinned.");

    const pin3 = page.getByRole("button", { name: "Pin Focus 3" });
    await pin3.focus();
    await pin3.press("Enter");
    await expect(pin3).toHaveAttribute("aria-pressed", "true");
    await expect(pinStatus).toHaveText("3 of 3 focus items pinned.");

    const pin4 = page.getByRole("button", { name: "Pin Focus 4" });
    await pin4.click();
    await expect(pin4).toHaveAttribute("aria-pressed", "false");
    await expect(pinStatus).toHaveText(
      "Swap required: 3 of 3 focus items already pinned.",
    );

    const noteInput = page.getByLabel("Focus note");
    await noteInput.fill("Verify WCAG 2.2 AA focus ring");
    await page.getByRole("button", { name: "Save Note" }).click();
    await expect(page.locator("#note-status")).toHaveText(
      "Saved note: Verify WCAG 2.2 AA focus ring",
    );
  });
});
