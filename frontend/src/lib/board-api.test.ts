import { loadBoard, saveBoard } from "@/lib/board-api";
import { initialData } from "@/lib/kanban";

describe("board API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the current user's board", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => initialData,
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadBoard()).resolves.toEqual(initialData);
    expect(fetchMock).toHaveBeenCalledWith("/api/board");
  });

  it("saves the board and reports API errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialData,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: "Invalid board" }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveBoard(initialData)).resolves.toEqual(initialData);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/board",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(initialData),
      })
    );
    await expect(saveBoard(initialData)).rejects.toThrow("Invalid board");
  });
});
