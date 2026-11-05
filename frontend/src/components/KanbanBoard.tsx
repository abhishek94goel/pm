"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { KanbanColumn } from "@/components/KanbanColumn";
import { loadBoard, saveBoard } from "@/lib/board-api";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  onLogout: () => Promise<void>;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const pendingBoard = useRef<BoardData | null>(null);
  const isSaving = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    let cancelled = false;
    void loadBoard()
      .then((loadedBoard) => {
        if (!cancelled) {
          setBoard(loadedBoard);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load your board."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!board) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsSavingBoard(true);
      pendingBoard.current = board;
      void (async () => {
        if (isSaving.current) {
          return;
        }
        isSaving.current = true;
        while (pendingBoard.current) {
          const nextBoard = pendingBoard.current;
          pendingBoard.current = null;
          try {
            await saveBoard(nextBoard);
            setSaveError(null);
          } catch (error) {
            setSaveError(
              error instanceof Error ? error.message : "Unable to save your board."
            );
            if (!pendingBoard.current) {
              break;
            }
          }
        }
        isSaving.current = false;
        setIsSavingBoard(false);
      })();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [board]);

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]">
        Loading your board...
      </main>
    );
  }

  if (!board) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert" className="text-sm text-red-700">
          Unable to load your board: {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            setIsLoading(true);
            setLoadError(null);
            setLoadAttempt((attempt) => attempt + 1);
          }}
          className="rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        columns: moveCard(prev.columns, active.id as string, over.id as string),
      };
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        columns: prev.columns.map((column) =>
          column.id === columnId ? { ...column, title } : column
        ),
      };
    });
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: { id, title, details: details || "No details yet." },
        },
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? { ...column, cardIds: [...column.cardIds, id] }
            : column
        ),
      };
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...prev.cards[cardId], title, details },
        },
      };
    });
  };

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await onLogout();
    } catch {
      setLogoutError("Unable to sign out. Please try again.");
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto min-h-screen max-w-[1500px] px-6 pb-16 pt-12">
        <div className="grid items-start gap-8 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-10">
            <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                    Single Board Kanban
                  </p>
                  <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                    Kanban Studio
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                    Keep momentum visible. Rename columns, drag cards between stages,
                    and capture quick notes without getting buried in settings.
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                    Focus
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                    One board. Five columns. Zero clutter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-full border border-[var(--stroke)] px-5 py-3 text-sm font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
                >
                  Sign out
                </button>
              </div>
              {logoutError && (
                <p role="alert" className="text-sm font-medium text-red-700">
                  {logoutError}
                </p>
              )}
              {saveError ? (
                <p role="alert" className="text-sm font-medium text-red-700">
                  Unable to save your latest board changes: {saveError}
                </p>
              ) : (
                <p
                  aria-live="polite"
                  className="text-xs text-[var(--gray-text)]"
                  data-testid="board-save-status"
                >
                  {isSavingBoard ? "Saving board changes..." : "Board saved."}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4">
                {board.columns.map((column) => (
                  <div
                    key={column.id}
                    className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
                  >
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                    {column.title}
                  </div>
                ))}
              </div>
            </header>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <section className="grid gap-6 lg:grid-cols-5">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId])}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                    onEditCard={handleEditCard}
                  />
                ))}
              </section>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[260px]">
                    <KanbanCardPreview card={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
          <AIChatSidebar onBoardUpdate={(updatedBoard) => setBoard(updatedBoard)} />
        </div>
      </main>
    </div>
  );
};
