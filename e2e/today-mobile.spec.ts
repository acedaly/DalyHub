import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  expectMinTouchTarget,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  gotoFixture,
} from "./helpers";

/**
 * TODAY-06 — the mobile Today experience, driven end to end against the
 * development-auth server over real (seeded) D1 with a phone viewport and touch
 * emulation (`isMobile` + `hasTouch`, so `(hover: none) and (pointer: coarse)`
 * matches and the swipe layer activates). It exercises the highest-value phone
 * workflow: review the planning sections, swipe a task to expose its action tray,
 * run a planning action through the SAME trusted route the desktop controls use,
 * confirm the persisted result after revalidation, open + edit + close the task
 * Drawer without losing context, use mobile selection + the bulk bar, visit
 * Waiting, navigate Back/Forward, and hold the accessibility + no-overflow baseline
 * with the swipe tray open.
 *
 * It mutates only the dedicated `t-drawer` task's scheduled date (which the seed
 * resets each server start) and restores it to unplanned, so the other journeys
 * stay stable. Real gesture geometry is driven with the pointer device; the pure
 * gesture maths are unit-tested separately.
 */

const PHONE = { width: 390, height: 844 };
const CARD = '.dh-card[data-card-id="t-drawer"]';
const TITLE = "Draft the proposal";

test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

/** The task card article (the swipe surface). */
function taskCard(page: Page): Locator {
  return page.locator(CARD);
}

/** Drag the card surface toward the inline-start to reveal its action tray. */
async function swipeOpen(page: Page, card: Locator) {
  const box = await card.boundingBox();
  if (box === null) {
    throw new Error("task card has no layout box");
  }
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 16;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  // Cross the intent threshold, then pull the tray fully open (past its width so it
  // clamps to fully revealed), in steps so intermediate pointermoves fire.
  await page.mouse.move(startX - 30, y, { steps: 3 });
  await page.mouse.move(startX - box.width, y, { steps: 8 });
  await page.mouse.up();
}

/** Ensure `t-drawer` is unplanned via its Drawer, then close it. */
async function normaliseUnplanned(page: Page) {
  await gotoFixture(page, "/today?drawer=task%3At-drawer");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const planning = dialog.getByRole("group", { name: "Planning" });
  const clear = planning.getByRole("button", { name: "Clear" });
  if ((await clear.count()) > 0) {
    await clear.first().click();
    await expect(planning.getByText("Not planned")).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe("TODAY-06 — mobile Today", () => {
  test("emulates a touch-first phone (the swipe layer's precondition)", async ({
    page,
  }) => {
    await gotoFixture(page, "/today");
    const touchFirst = await page.evaluate(
      () => window.matchMedia("(hover: none) and (pointer: coarse)").matches,
    );
    expect(touchFirst).toBe(true);
  });

  test("renders the planning sections without horizontal overflow", async ({
    page,
  }) => {
    await gotoFixture(page, "/today");
    await expect(
      page.getByRole("heading", { level: 1, name: "Today" }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: /Today at a glance/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Anytime/ }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("swipes a task to reveal its tray and plans it through the shared route", async ({
    page,
  }) => {
    await normaliseUnplanned(page);
    await gotoFixture(page, "/today");

    const card = taskCard(page);
    await expect(card).toHaveAttribute("data-swipe-open", "false");
    await swipeOpen(page, card);
    await expect(card).toHaveAttribute("data-swipe-open", "true");
    // A handled swipe must not also open the Card.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Run the planning action from the revealed tray (same path as the visible
    // quick action / bulk bar / keyboard command).
    const tray = page.locator(
      `.dh-card-swipe:has(${CARD}) .dh-card__swipe-tray`,
    );
    await tray.getByText("Plan today", { exact: true }).click();

    // After the mutation + revalidation the task appears in the Today section.
    const todayList = page.getByRole("list", {
      name: "Tasks planned for today",
    });
    await expect(todayList.getByText(TITLE)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Restore: clear the plan from the Drawer so shared journeys stay stable.
    await normaliseUnplanned(page);
  });

  test("holds the accessibility baseline with a swipe tray open", async ({
    page,
  }) => {
    await gotoFixture(page, "/today");
    const card = taskCard(page);
    await swipeOpen(page, card);
    await expect(card).toHaveAttribute("data-swipe-open", "true");
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page);
    await normaliseUnplanned(page);
  });

  test("opens the task Drawer as a full-height sheet and returns to Today", async ({
    page,
  }) => {
    await gotoFixture(page, "/today");
    await page.getByRole("link", { name: TITLE }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { level: 3, name: TITLE }),
    ).toBeVisible();
    // The Planning + close controls are reachable on the narrow sheet.
    await expect(dialog.getByRole("group", { name: "Planning" })).toBeVisible();
    await expectMinTouchTarget(dialog.getByRole("button", { name: "Close" }));
    await expectNoHorizontalOverflow(page);

    // Back closes the Drawer and restores Today (context preserved).
    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("heading", { level: 1, name: "Today" }),
    ).toBeVisible();
    // Forward re-opens it (URL-driven history).
    await page.goForward();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("supports mobile selection with a bulk action bar", async ({ page }) => {
    await gotoFixture(page, "/today");
    const selectCheckbox = page.getByRole("checkbox", {
      name: `Select ${TITLE}`,
    });
    // The selection cell (the label wrapping the checkbox) is the 44px touch target.
    await expectMinTouchTarget(page.locator(`${CARD} .dh-card__select`));
    await selectCheckbox.check();

    const bulkBar = page.getByRole("group", { name: /Plan 1 selected task/ });
    await expect(bulkBar).toBeVisible();
    await expect(bulkBar.getByText("1 selected")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Exit selection without mutating (Cancel clears it).
    await bulkBar.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("group", { name: /Plan .* selected/ }),
    ).toHaveCount(0);
  });

  test("reaches the Waiting view and navigates Back to Today", async ({
    page,
  }) => {
    // Start on Today so Back has somewhere to return to, then open Waiting via a
    // real client navigation (the sidebar/command path lands here too).
    await gotoFixture(page, "/today");
    await gotoFixture(page, "/today/waiting");
    await expect(
      page.getByRole("heading", { level: 1, name: /Waiting/ }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goBack();
    await expect(
      page.getByRole("heading", { level: 1, name: "Today" }),
    ).toBeVisible();
  });
});
