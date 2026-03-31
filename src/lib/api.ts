/**
 * Frontdesk AI — API Client
 * Typed wrapper around the FastAPI backend.
 * All calls include Clerk auth token in Authorization header.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getAuthToken(): Promise<string> {
  // In Next.js + Clerk: import { auth } from "@clerk/nextjs/server" for server
  // On client: use useAuth() hook from Clerk
  // This placeholder is replaced by Clerk token in actual components
  return "";
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error ${res.status}`);
  }

  return res.json();
}

// ── Dashboard / Analytics ──────────────────────────────────────
export async function getDashboardSummary(businessId: string, period = "today") {
  return apiFetch(`/analytics/summary?business_id=${businessId}&period=${period}`);
}

export async function getIntentBreakdown(businessId: string, period = "today") {
  return apiFetch(`/analytics/intent-breakdown?business_id=${businessId}&period=${period}`);
}

// ── Approval Queue ─────────────────────────────────────────────
export async function getQueue(businessId: string, status = "pending") {
  return apiFetch(`/queue?business_id=${businessId}&status=${status}`);
}

export async function approveQueueItem(itemId: string, reviewerId: string) {
  return apiFetch(`/queue/${itemId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewer_id: reviewerId }),
  });
}

export async function editAndSendQueueItem(
  itemId: string,
  reviewerId: string,
  editedBody: string
) {
  return apiFetch(`/queue/${itemId}/edit-and-send`, {
    method: "POST",
    body: JSON.stringify({ reviewer_id: reviewerId, edited_body: editedBody }),
  });
}

export async function dismissQueueItem(itemId: string, reviewerId: string, reason?: string) {
  return apiFetch(`/queue/${itemId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ reviewer_id: reviewerId, reason }),
  });
}

// ── Messages ───────────────────────────────────────────────────
export async function getMessages(businessId: string, page = 1) {
  return apiFetch(`/messages?business_id=${businessId}&page=${page}`);
}

export async function getMessage(messageId: string) {
  return apiFetch(`/messages/${messageId}`);
}

// ── Conversations ──────────────────────────────────────────────
export async function getConversations(businessId: string) {
  return apiFetch(`/conversations?business_id=${businessId}`);
}

export async function getConversationMessages(conversationId: string) {
  return apiFetch(`/conversations/${conversationId}/messages`);
}

// ── Billing ────────────────────────────────────────────────────
export async function getBillingPlan(businessId: string) {
  return apiFetch(`/billing/plan?business_id=${businessId}`);
}

export async function createCheckout(businessId: string, planTier: string) {
  return apiFetch(`/billing/create-checkout?business_id=${businessId}&plan_tier=${planTier}&return_url=${window.location.origin}/billing`);
}
