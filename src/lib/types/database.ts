/**
 * Typed view of the public schema (supabase/migrations). Kept in sync by hand with the migrations;
 * regenerate with `supabase gen types typescript` when the Supabase CLI is available.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "student" | "admin";
export type SkillPriority = "high" | "medium" | "low";
export type SkillTrend = "rising" | "stable" | "declining";
export type AttemptStatus = "in_progress" | "submitted";
export type DeletionStatus = "pending" | "approved" | "denied" | "cancelled";
export type PolicyType = "terms" | "privacy";
export type SuggestionKind = "add_skill" | "remove_skill" | "raise_weight" | "lower_weight";
export type SuggestionStatus = "suggested" | "approved" | "rejected";
export type NotificationType = "results" | "report" | "platform" | "policy" | "deletion" | "roles" | "trends" | "rating";
export type Band = "Ready" | "Competitive" | "Developing" | "Early stage";

export interface NotificationPrefs {
  results: boolean;
  report: boolean;
  platform: boolean;
  policy: boolean;
  /** Admin-only types; a missing key means "on". */
  deletion?: boolean;
  roles?: boolean;
  trends?: boolean;
  rating?: boolean;
}

type Table<Row, Insert = Partial<Row>> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: [] };

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  college: string | null;
  branch: string | null;
  year_of_study: "3rd" | "4th" | null;
  skills: string[];
  target_role_id: string | null;
  target_role_other: string | null;
  details_completed: boolean;
  details_skipped: boolean;
  notification_prefs: NotificationPrefs;
  created_at: string;
  updated_at: string;
}
export type RoleRow = {
  id: string;
  name: string;
  is_active: boolean;
  declining_skills: string[];
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
export type SkillRow = {
  id: string;
  name: string;
  why: string | null;
  created_at: string;
}
export type RoleSkillRow = {
  role_id: string;
  skill_id: string;
  weight: number;
  priority: SkillPriority;
  trend: SkillTrend;
  trend_change: string | null;
  updated_at: string;
}
export interface RequirementSnapshot {
  skill: string;
  weight: number;
  priority: SkillPriority;
  trend: SkillTrend | null;
  trend_change: string | null;
  why: string | null;
}
export interface ResultRow extends RequirementSnapshot {
  tested: boolean;
  proficiency: number;
  status: "matched" | "weak" | "missing";
  points: number;
}
export interface AttemptResult {
  score: number;
  band: Band;
  rows: ResultRow[];
  tested_count: number;
  question_count: number;
  correct_count: number;
  delta: number | null;
  previous_attempt_id: string | null;
  previous_date: string | null;
}
export interface ActionItem {
  skill: string;
  status: "weak" | "missing";
  priority: SkillPriority;
  trend: SkillTrend | null;
  why: string;
  next_step: string;
  resources: { title: string; kind: string; search_query: string; level: string | null }[];
  ai_generated: boolean;
}
export interface AttemptInsights {
  actions: ActionItem[];
  summary: string;
  trend_summary: string;
  ai_generated: boolean;
  model: string | null;
  generated_at: string;
}
export type AttemptRow = {
  id: string;
  user_id: string;
  role_id: string | null;
  role_name: string;
  is_custom_role: boolean;
  status: AttemptStatus;
  claimed_skills: string[];
  requirements: RequirementSnapshot[];
  declining_skills: string[];
  trends_updated_at: string | null;
  current_position: number;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  band: Band | null;
  result: AttemptResult | null;
  insights: AttemptInsights | null;
  insights_generated_at: string | null;
}
export type AttemptQuestionRow = {
  attempt_id: string;
  position: number;
  question_id: string;
  skill_name: string;
  selected_index: number | null;
  flagged: boolean;
  answered_at: string | null;
}
export type QuestionRow = {
  id: string;
  skill_id: string;
  prompt: string;
  options: string[];
  source: "seed" | "ai" | "admin";
  model: string | null;
  status: "active" | "retired";
  created_at: string;
}
export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  attempt_id: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
}
export type FeedbackRow = {
  id: string;
  user_id: string;
  attempt_id: string | null;
  kind: "result" | "general";
  rating: number;
  topic: string | null;
  message: string;
  created_at: string;
}
export type PolicyRow = {
  id: string;
  type: PolicyType;
  version: string;
  body: string;
  change_note: string | null;
  published_at: string;
  published_by: string | null;
}
export type DeletionRequestRow = {
  id: string;
  user_id: string | null;
  student_name: string;
  student_email: string;
  college: string | null;
  attempt_count: number;
  reason: string;
  status: DeletionStatus;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}
export type ReportRow = {
  id: string;
  attempt_id: string;
  user_id: string;
  storage_key: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}
export type SkillSuggestionRow = {
  id: string;
  run_id: string | null;
  role_id: string;
  kind: SuggestionKind;
  skill_name: string;
  from_weight: number | null;
  to_weight: number | null;
  from_priority: SkillPriority | null;
  to_priority: SkillPriority | null;
  rationale: string;
  status: SuggestionStatus;
  suggested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  applied: boolean;
}
export type ResearchRunRow = {
  id: string;
  trigger_source: "cron" | "manual";
  status: "running" | "succeeded" | "partial" | "failed";
  model: string | null;
  roles_total: number;
  roles_ok: number;
  suggestions_created: number;
  suggestions_applied: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}
export type CustomRoleEstimateRow = {
  id: string;
  name: string;
  name_key: string;
  requirements: RequirementSnapshot[];
  request_count: number;
  model: string | null;
  promoted_role_id: string | null;
  created_at: string;
  updated_at: string;
}
export type ActivityRow = {
  id: number;
  kind: string;
  summary: string;
  detail: string | null;
  actor_id: string | null;
  created_at: string;
}

export type AdminStudentRow = {
  id: string;
  full_name: string;
  email: string;
  college: string | null;
  year_of_study: string | null;
  role_label: string | null;
  attempts: number;
  latest_score: number | null;
  created_at: string;
  total_count: number;
}

export interface AdminDashboard {
  students_total: number;
  students_new_7d: number;
  diagnostics_total: number;
  diagnostics_7d: number;
  avg_score: number | null;
  avg_rating: number | null;
  feedback_total: number;
  pending_deletions: number;
  suggestions_pending: number;
  typed_roles: number;
  last_research: { id: string; status: string; finished_at: string | null; started_at: string; suggestions_created: number; suggestions_applied: number } | null;
  recent_activity: { kind: string; summary: string; detail: string | null; created_at: string }[];
}

export interface AdminAnalytics {
  days: number;
  registered_total: number;
  registered_in_range: number;
  started_in_range: number;
  completed_in_range: number;
  completed_total: number;
  avg_score: number | null;
  daily: { day: string; registrations: number; diagnostics: number }[];
  by_role: { role: string; count: number; avg_score: number | null }[];
  bands: Partial<Record<Band, number>>;
  common_gaps: { skill: string; missing: number; weak: number; total: number }[];
  feedback: { count: number; avg: number | null; distribution: Record<string, number> };
  ai: { requests: number; failures: number };
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      roles: Table<RoleRow>;
      skills: Table<SkillRow>;
      role_skills: Table<RoleSkillRow>;
      questions: Table<QuestionRow>;
      attempts: Table<AttemptRow>;
      attempt_questions: Table<AttemptQuestionRow>;
      notifications: Table<NotificationRow>;
      feedback: Table<FeedbackRow, Pick<FeedbackRow, "user_id" | "kind" | "rating"> & Partial<FeedbackRow>>;
      policies: Table<PolicyRow>;
      policy_acceptances: Table<{ user_id: string; policy_id: string; accepted_at: string }>;
      deletion_requests: Table<DeletionRequestRow>;
      reports: Table<ReportRow>;
      skill_suggestions: Table<SkillSuggestionRow>;
      market_research_runs: Table<ResearchRunRow>;
      custom_role_estimates: Table<CustomRoleEstimateRow>;
      activity_log: Table<ActivityRow>;
      app_settings: Table<{ key: string; value: Json; updated_at: string; updated_by: string | null }>;
      ai_requests: Table<{ id: number; user_id: string | null; kind: string; model: string | null; ok: boolean; latency_ms: number | null; error: string | null; created_at: string }>;
      question_keys: Table<{ question_id: string; correct_index: number; explanation: string | null }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      pending_policies: { Args: Record<string, never>; Returns: { id: string; type: PolicyType; version: string }[] };
      accept_policies: { Args: { p_policy_ids: string[] }; Returns: undefined };
      start_attempt: { Args: { p_role_id: string | null; p_custom_role: string | null; p_skills: string[] }; Returns: string };
      save_answer: { Args: { p_attempt: string; p_position: number; p_selected?: number | null; p_flagged?: boolean | null }; Returns: undefined };
      submit_attempt: { Args: { p_attempt: string }; Returns: AttemptResult };
      save_attempt_insights: { Args: { p_attempt: string; p_insights: Json }; Returns: undefined };
      mark_notification_read: { Args: { p_id: string }; Returns: undefined };
      mark_all_notifications_read: { Args: Record<string, never>; Returns: number };
      request_account_deletion: { Args: { p_reason?: string }; Returns: string };
      cancel_account_deletion: { Args: Record<string, never>; Returns: undefined };
      admin_resolve_deletion: { Args: { p_id: string; p_approve: boolean }; Returns: undefined };
      admin_publish_policy: { Args: { p_type: PolicyType; p_version: string; p_body: string; p_note?: string | null }; Returns: string };
      admin_save_role_skills: { Args: { p_role: string; p_items: Json }; Returns: undefined };
      admin_create_role: { Args: { p_name: string; p_items: Json }; Returns: string };
      admin_promote_custom_role: { Args: { p_estimate: string }; Returns: string };
      admin_set_role_active: { Args: { p_role: string; p_active: boolean }; Returns: undefined };
      admin_set_attempt_limit: { Args: { p_limit: number }; Returns: undefined };
      admin_dashboard: { Args: Record<string, never>; Returns: AdminDashboard };
      admin_analytics: { Args: { p_days?: number }; Returns: AdminAnalytics };
      admin_list_students: {
        Args: { p_search?: string | null; p_role?: string | null; p_limit?: number; p_offset?: number };
        Returns: AdminStudentRow[];
      };
      admin_typed_skills: { Args: Record<string, never>; Returns: { skill: string; students: number }[] };
      create_notification: {
        Args: { p_user: string; p_type: NotificationType; p_title: string; p_body?: string; p_attempt?: string | null; p_link?: string | null };
        Returns: undefined;
      };
      service_apply_role_update: {
        Args: { p_role: string; p_items: Json | null; p_declining: string[] | null; p_applied: string[]; p_rejected: string[]; p_note: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
