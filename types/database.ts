export type Role = "admin" | "user";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  name: string;
  description: string | null;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  secret: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KeepAliveLog {
  id: string;
  site_id: string;
  status_code: number | null;
  response_body: Record<string, unknown> | null;
  response_time_ms: number | null;
  success: boolean;
  error_message: string | null;
  sent_at: string;
}

export interface SiteWithLogs extends Site {
  keep_alive_logs: KeepAliveLog[];
}
