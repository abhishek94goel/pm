import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
}

test("requires sign-in and loads the kanban board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("restores the signed-in session after reload", async ({ page }) => {
  await signIn(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("adds and edits a card, keeping the changes after reload", async ({ page }) => {
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const addedCard = "Playwright card";
  const editedCard = "Playwright updated card";
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  const addSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/board") &&
      response.request().method() === "PUT" &&
      response.request().postData()?.includes(addedCard) === true
  );
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await addSaved;
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
  await page.reload();
  const persistedCard = page
    .locator('[data-testid^="column-"]')
    .first()
    .locator('[data-testid^="card-"]')
    .filter({ hasText: addedCard });
  await expect(persistedCard).toBeVisible();
  const persistedCardId = await persistedCard.getAttribute("data-testid");
  if (!persistedCardId) {
    throw new Error("Unable to resolve the saved card ID.");
  }
  const cardUnderEdit = page.getByTestId(persistedCardId);
  await persistedCard.getByRole("button", { name: `Edit ${addedCard}` }).click();
  await page.getByLabel("Card title").fill(editedCard);
  const editSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/board") &&
      response.request().method() === "PUT" &&
      response.request().postData()?.includes(editedCard) === true
  );
  await cardUnderEdit.getByRole("button", { name: "Save changes" }).click();
  await editSaved;
  await page.reload();
  const reloadedCard = page
    .locator('[data-testid^="column-"]')
    .first()
    .locator('[data-testid^="card-"]')
    .filter({ hasText: editedCard });
  await expect(reloadedCard).toBeVisible();
  const deleteSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/board") &&
      response.request().method() === "PUT" &&
      !response.request().postData()?.includes(editedCard)
  );
  await reloadedCard.getByRole("button", { name: `Delete ${editedCard}` }).click();
  await deleteSaved;
});

test("persists a column rename after reload", async ({ page }) => {
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const title = firstColumn.getByLabel("Column title");
  const renamedTitle = "Playwright Backlog";
  const renameSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/board") &&
      response.request().method() === "PUT" &&
      response.request().postData()?.includes(renamedTitle) === true
  );
  await title.fill(renamedTitle);
  await renameSaved;
  await page.reload();
  await expect(
    page
      .locator('[data-testid^="column-"]')
      .first()
      .getByLabel("Column title")
  ).toHaveValue("Playwright Backlog");
});

test("moves a card and keeps its position after reload", async ({ page }) => {
  await signIn(page);
  const card = page
    .locator('[data-testid^="card-"]')
    .filter({ hasText: "Align roadmap themes" });
  const targetColumn = page.locator('[data-testid^="column-"]').nth(3);
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  const cardTestId = await card.getAttribute("data-testid");
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  if (!cardTestId) {
    throw new Error("Unable to resolve the card ID.");
  }
  const cardId = cardTestId.slice("card-".length);
  const moveSaved = page.waitForResponse((response) => {
    if (
      !response.url().endsWith("/api/board") ||
      response.request().method() !== "PUT"
    ) {
      return false;
    }
    const body = response.request().postDataJSON();
    return body.columns[3].cardIds.includes(cardId);
  });

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(
    targetColumn
      .locator('[data-testid^="card-"]')
      .filter({ hasText: "Align roadmap themes" })
  ).toBeVisible();
  await moveSaved;
  await page.reload();
  await expect(
    page
      .locator('[data-testid^="column-"]')
      .nth(3)
      .getByText("Align roadmap themes")
  ).toBeVisible();
});

test("applies and persists a board update from AI chat", async ({ page }) => {
  await signIn(page);
  const currentBoardResponse = await page.request.get("/api/board");
  const board = await currentBoardResponse.json();
  const cardId = board.columns[0].cardIds.shift();
  if (!cardId) {
    throw new Error("Unable to resolve a card to move.");
  }
  board.columns[3].cardIds.push(cardId);
  board.cards[cardId].title = "Updated by AI";

  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "I moved and updated the card.",
        board,
      }),
    })
  );
  const boardSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/board") &&
      response.request().method() === "PUT" &&
      response.request().postData()?.includes("Updated by AI") === true
  );

  await page.getByLabel("Message").fill("Move this card to review and rename it");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("I moved and updated the card.")).toBeVisible();
  await expect(
    page.locator('[data-testid^="column-"]').nth(3).getByText("Updated by AI")
  ).toBeVisible();
  await boardSaved;

  await page.reload();
  await expect(
    page.locator('[data-testid^="column-"]').nth(3).getByText("Updated by AI")
  ).toBeVisible();
});

test("signs out and hides the board", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).not.toBeVisible();
});
