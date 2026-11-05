import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { sendChat } from "@/lib/chat-api";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/chat-api", () => ({
  sendChat: vi.fn(),
}));

describe("AIChatSidebar", () => {
  it("sends a message, shows the answer, and applies the returned board", async () => {
    const updatedBoard = {
      ...initialData,
      columns: initialData.columns.map((column, index) =>
        index === 0 ? { ...column, title: "AI updated" } : column
      ),
    };
    vi.mocked(sendChat).mockResolvedValue({
      answer: "I renamed the first column.",
      board: updatedBoard,
    });
    const onBoardUpdate = vi.fn();

    render(<AIChatSidebar onBoardUpdate={onBoardUpdate} />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "  Rename the first column  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("I renamed the first column.")).toBeInTheDocument();
    expect(sendChat).toHaveBeenCalledWith("Rename the first column", []);
    await waitFor(() => {
      expect(onBoardUpdate).toHaveBeenCalledWith(updatedBoard);
    });
  });

  it("shows a clear error when chat fails", async () => {
    vi.mocked(sendChat).mockRejectedValue(new Error("Service unavailable"));

    render(<AIChatSidebar onBoardUpdate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Help me plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service unavailable"
    );
  });
});
