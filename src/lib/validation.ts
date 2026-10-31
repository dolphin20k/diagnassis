import { z } from "zod";

export const YEARS = ["3rd", "4th"] as const;

export const BRANCHES = [
  "Computer Science and Engineering",
  "CSE (Artificial Intelligence and Machine Learning)",
  "CSE (Data Science)",
  "CSE (Cyber Security)",
  "Information Technology",
] as const;

export const FEEDBACK_TOPICS = ["Test questions", "Results and scoring", "Learning resources", "Something else"] as const;

export const emailSchema = z.string().trim().min(1, "Enter your email address.").email("Enter a valid email, like name@college.edu.").max(254);

export function passwordRules(p: string): [string, boolean][] {
  return [
    ["At least 8 characters", p.length >= 8],
    ["One uppercase letter", /[A-Z]/.test(p)],
    ["One number", /[0-9]/.test(p)],
    ["One symbol", /[^A-Za-z0-9]/.test(p)],
  ];
}
export const passwordScore = (p: string) => passwordRules(p).filter(([, ok]) => ok).length;
export const passwordSchema = z
  .string()
  .min(8, "Meet all four password rules below.")
  .max(72)
  .refine((p) => passwordScore(p) === 4, "Meet all four password rules below.");

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(120),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string().min(1, "Confirm your password."),
    agree: z.literal(true, { errorMap: () => ({ message: "You need to accept the terms to create an account." }) }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") });

export const profileSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(120),
    college: z.string().trim().min(1, "Enter your college name.").max(160),
    branch: z.string().trim().min(1, "Choose your branch.").max(120),
    year: z.enum(YEARS, { errorMap: () => ({ message: "Choose your year of study." }) }),
    skills: z.array(z.string().trim().min(1).max(60)).min(1, "Add at least one skill you already have.").max(60),
    roleId: z.string().uuid().nullable(),
    roleOther: z.string().trim().max(80).nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.roleId && !(v.roleOther && v.roleOther.length >= 2)) {
      ctx.addIssue({ code: "custom", path: ["role"], message: v.roleOther === null ? "Choose a target role." : "Type the role you are aiming for." });
    }
  });
export type ProfileInput = z.infer<typeof profileSchema>;

export const feedbackSchema = z.object({
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  topic: z.enum(FEEDBACK_TOPICS).nullable(),
  message: z.string().trim().min(10, "Tell us a little more, at least 10 characters.").max(2000),
});

export const policyPublishSchema = z.object({
  type: z.enum(["terms", "privacy"]),
  version: z.string().regex(/^[0-9]+(\.[0-9]+){1,2}$/, "Use a version like 1.5 or 2.0.1."),
  body: z.string().trim().min(20, "Policy text is too short.").max(40000),
  note: z.string().trim().max(400).optional(),
});

export const roleItemsSchema = z
  .array(
    z.object({
      skill: z.string().trim().min(1).max(60),
      weight: z.number().gt(0).lte(100),
      priority: z.enum(["high", "medium", "low"]),
    }),
  )
  .min(1)
  .max(20);
