"use client";

import { useCallback, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { SignInForm } from "@/components/SignInForm";

type AuthState = "checking" | "signedOut" | "signedIn" | "error";

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("checking");

  const checkSession = useCallback(async () => {
    setAuthState("checking");
    try {
      const response = await fetch("/api/auth/me");
      if (response.status === 401) {
        setAuthState("signedOut");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to check the current session.");
      }
      setAuthState("signedIn");
    } catch {
      setAuthState("error");
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error("Unable to sign out.");
    }
    setAuthState("signedOut");
  };

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]">
        Checking your session...
      </main>
    );
  }

  if (authState === "signedOut") {
    return <SignInForm onSignedIn={() => setAuthState("signedIn")} />;
  }

  if (authState === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert" className="text-sm text-red-700">
          Unable to connect to the server.
        </p>
        <button
          type="button"
          onClick={() => void checkSession()}
          className="rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  return <KanbanBoard onLogout={handleLogout} />;
}
