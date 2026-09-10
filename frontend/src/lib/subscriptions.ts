/**
 * Client for the anonymous email-subscription endpoints (POST /subscriptions,
 * /subscriptions/manage/{token}).
 */

export type SubscriptionTier = "Low" | "Moderate" | "High";
export type SubscriptionTrend = "up" | "down" | "stable";

export interface RegionReportRow {
  code: string;
  short: string;
  name: string;
  cases: number;
  value: number; // cases per 100k
  tier: SubscriptionTier;
  trend: SubscriptionTrend;
  pct_change: number;
  sparkline: number[]; // last 12 monthly per-capita values
}

export interface SubscriptionReport {
  month: string;
  month_key: string;
  illness: string;
  illness_label: string;
  scope: "all" | "custom";
  scope_label: string;
  total_regions: number;
  featured_count: number;
  national: {
    label: string;
    cases: number;
    value: number;
    tier: SubscriptionTier;
    trend: SubscriptionTrend;
    pct_change: number;
  };
  regions: RegionReportRow[];
}

export interface SubscribeResponse {
  status: "subscribed";
  token: string;
  email: string;
  provider: "resend" | "dry-run";
  report: SubscriptionReport;
}

export interface SubscriptionPrefs {
  email: string;
  regions: string[];
  illness: string;
  active: boolean;
  created_at: string;
  last_sent_at: string | null;
  sent_count: number;
}

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON error body — keep status text */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function subscribe(
  email: string,
  regions: string[],
  illness: string,
): Promise<SubscribeResponse> {
  return request<SubscribeResponse>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ email, regions, illness }),
  });
}

export function getSubscription(token: string): Promise<SubscriptionPrefs> {
  return request<SubscriptionPrefs>(`/subscriptions/manage/${encodeURIComponent(token)}`);
}

export function updateSubscription(
  token: string,
  regions: string[],
  illness: string,
): Promise<SubscriptionPrefs> {
  return request<SubscriptionPrefs>(`/subscriptions/manage/${encodeURIComponent(token)}`, {
    method: "PATCH",
    body: JSON.stringify({ regions, illness }),
  });
}

export function unsubscribeSubscription(token: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/subscriptions/manage/${encodeURIComponent(token)}`, {
    method: "DELETE",
  });
}