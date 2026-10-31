/** Maps database / API machine codes to messages that are safe and useful to show users. */
const MESSAGES: Record<string, string> = {
  details_required: "Complete your basic details before starting a diagnostic.",
  policies_not_accepted: "Please accept the latest Terms and Privacy Policy to continue.",
  attempt_in_progress: "You already have a diagnostic in progress. Resume it from your dashboard.",
  attempt_limit_reached: "You have used all of your diagnostics.",
  role_not_found: "That role is no longer available.",
  role_has_no_skills: "That role is not ready yet. Choose another role.",
  custom_role_not_estimated: "We could not prepare that custom role. Try again.",
  role_required: "Choose a target role first.",
  skills_required: "Add at least one skill you already have.",
  no_testable_skills: "None of your skills overlap with this role's requirements, so there is nothing to test yet. Add skills this role asks for.",
  attempt_not_found: "We could not find that diagnostic.",
  invalid_option: "That answer option is not valid.",
  question_not_found: "That question is not part of this diagnostic.",
  forbidden: "You do not have permission to do that.",
  not_authenticated: "Your session has expired. Please log in again.",
  deletion_already_pending: "You already have a deletion request pending.",
  admin_cannot_delete: "Administrator accounts cannot be deleted from here.",
  cannot_delete_self: "You cannot delete your own administrator account.",
  request_not_pending: "That request has already been handled.",
  version_must_increase: "The new version number must be higher than the current one.",
  invalid_version: "Use a version like 1.5 or 2.0.1.",
  weights_must_total_100: "Skill weights must add up to exactly 100%.",
  duplicate_skill: "A skill appears more than once.",
  invalid_weight: "Each weight must be between 0 and 100.",
  invalid_items: "A role needs between 1 and 20 skills.",
  policy_not_latest: "A newer version of that policy has been published. Reload and review it.",
  invalid_limit: "The limit must be between 1 and 50.",
  already_promoted: "That role was already added.",
};

export function friendlyError(message: string | undefined | null, fallback = "Something went wrong. Please try again."): string {
  if (!message) return fallback;
  const code = message.trim();
  return MESSAGES[code] ?? fallback;
}

export function isKnownCode(message: string | undefined | null): boolean {
  return !!message && message.trim() in MESSAGES;
}
