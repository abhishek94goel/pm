import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];
const renderBoard = () =>
  render(<KanbanBoard onLogout={async () => undefined} />);

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (_input, init) => ({
        ok: true,
        json: async () =>
          init?.method === "PUT" ? JSON.parse(String(init.body)) : initialData,
      }) as Response)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and renders the user's board", async () => {
    renderBoard();
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(fetch).toHaveBeenCalledWith("/api/board");
  });

  it("renames a column", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/board",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  it("adds and removes a card", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/board",
        expect.objectContaining({ method: "PUT" })
      );
    });

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("shows a clear error when the board cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ detail: "Service unavailable" }),
      } as Response)
    );
    renderBoard();

    expect(
      await screen.findByText(/Unable to load your board: Service unavailable/)
    ).toHaveAttribute("role", "alert");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a clear error when saving fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      json: async () => initialData,
    } as Response);
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "PUT"
        ? ({
            ok: false,
            status: 503,
            json: async () => ({ detail: "Service unavailable" }),
          } as Response)
        : ({ ok: true, json: async () => initialData } as Response)
    );
    vi.stubGlobal("fetch", fetchMock);
    renderBoard();

    const column = (await screen.findAllByTestId(/column-/i))[0];
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Changed");

    expect(
      await screen.findByText(
        "Unable to save your latest board changes: Service unavailable"
      )
    ).toBeInTheDocument();
  });
});
