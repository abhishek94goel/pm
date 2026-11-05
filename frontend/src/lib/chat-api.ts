import type { BoardData } from "@/lib/kanban";
import { responseError } from "@/lib/board-api";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  answer: string;
  board: BoardData;
};

export const sendChat = async (
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json();
};
