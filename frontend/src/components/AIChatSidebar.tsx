"use client";

import { useState, type FormEvent } from "react";
import { sendChat, type ChatMessage } from "@/lib/chat-api";
import type { BoardData } from "@/lib/kanban";

type AIChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
};

export const AIChatSidebar = ({ onBoardUpdate }: AIChatSidebarProps) => {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = message.trim();
    if (!request || isSending) {
      return;
    }

    setError(null);
    setMessage("");
    setConversation((current) => [...current, { role: "user", content: request }]);
    setIsSending(true);

    try {
      const response = await sendChat(request, conversation);
      setConversation((current) => [
        ...current,
        { role: "assistant", content: response.answer },
      ]);
      onBoardUpdate(response.board);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Unable to send your message."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      aria-label="AI assistant"
      className="flex min-h-[420px] flex-col overflow-hidden rounded-[28px] border border-[var(--stroke)] bg-white/90 shadow-[var(--shadow)] 2xl:sticky 2xl:top-6 2xl:h-[calc(100vh-3rem)]"
    >
      <header className="border-b border-[var(--stroke)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
          AI assistant
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
          Board chat
        </h2>
      </header>

      <ol
        aria-label="Conversation"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {conversation.length === 0 && (
          <li className="rounded-2xl bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--gray-text)]">
            Ask a question or request a change to your board.
          </li>
        )}
        {conversation.map((entry, index) => (
          <li
            key={`${index}-${entry.role}`}
            className={
              entry.role === "user"
                ? "self-end rounded-2xl bg-[var(--navy-dark)] px-4 py-3 text-sm leading-6 text-white"
                : "self-start rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--navy-dark)]"
            }
          >
            {entry.content}
          </li>
        ))}
        {isSending && (
          <li className="self-start px-2 text-sm text-[var(--gray-text)]">
            Thinking...
          </li>
        )}
      </ol>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="border-t border-[var(--stroke)] p-4"
      >
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <label
          htmlFor="chat-message"
          className="mb-2 block text-xs font-semibold text-[var(--gray-text)]"
        >
          Message
        </label>
        <textarea
          id="chat-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="Ask about your board..."
          className="w-full resize-none rounded-2xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={!message.trim() || isSending}
          className="mt-3 w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
};
