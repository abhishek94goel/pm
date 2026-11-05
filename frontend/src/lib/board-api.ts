import type { BoardData } from "@/lib/kanban";

export const responseError = async (response: Response): Promise<Error> => {
  try {
    const body: { detail?: string } = await response.json();
    if (body.detail) {
      return new Error(body.detail);
    }
  } catch {
    // Use the status-based message when the server does not return JSON.
  }
  return new Error(`Request failed with status ${response.status}.`);
};

export const loadBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json();
};

export const saveBoard = async (board: BoardData): Promise<BoardData> => {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json();
};
