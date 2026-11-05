import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInForm } from "@/components/SignInForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignInForm", () => {
  it("submits credentials and calls onSignedIn", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ username: "user" }),
    } as Response);
    const onSignedIn = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SignInForm onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "user", password: "password" }),
      })
    );
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it("shows a rejected login message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Invalid username or password" }),
      } as Response)
    );
    const user = userEvent.setup();

    render(<SignInForm onSignedIn={vi.fn()} />);
    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password"
    );
  });
});
