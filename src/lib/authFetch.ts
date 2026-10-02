/**
 * Attach the signed-in user's Clerk session token to every call to our API.
 * The backend rejects dashboard/API calls without it (see backend app/core/security.py).
 * Installed once, synchronously, from LayoutShell's first render so page effects that
 * fetch on mount are already covered.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const API_ORIGIN = (() => {
  try { return new URL(API_URL).origin; } catch { return ""; }
})();

type ClerkLike = { loaded?: boolean; session?: { getToken: () => Promise<string | null> } | null };

async function sessionToken(): Promise<string | null> {
  for (let i = 0; i < 50; i++) {            // wait up to ~5s for Clerk to finish loading
    const clerk = (window as unknown as { Clerk?: ClerkLike }).Clerk;
    if (clerk?.loaded) return clerk.session ? await clerk.session.getToken() : null;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

export function installAuthFetch() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __fdrAuthFetch?: boolean };
  if (w.__fdrAuthFetch || !API_ORIGIN) return;
  w.__fdrAuthFetch = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(API_ORIGIN)) return original(input, init);
    const token = await sessionToken();
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return original(input, { ...init, headers });
  };
}
