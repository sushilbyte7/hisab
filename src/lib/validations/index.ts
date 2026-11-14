import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense"]);

/** Amount: accepts a number or numeric string, must be > 0, max 2 decimals. */
export const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number(v) : v))
  .refine((n) => Number.isFinite(n), { message: "Amount must be a number" })
  .refine((n) => n > 0, { message: "Amount must be greater than zero" })
  .refine((n) => n <= 999_999_999.99, {
    message: "Amount is too large (max ₹99,99,99,999.99)",
  })
  .refine((n) => Math.round(n * 100) === n * 100, {
    message: "Amount can have at most 2 decimal places",
  });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" })
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00`)), {
    message: "Invalid date",
  });

export const transactionFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  amount: amountSchema,
  type: transactionTypeSchema,
  category_id: z.string().uuid("Choose a category"),
  payment_method: z.string().trim().max(100).optional().nullable(),
  transaction_date: isoDate,
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const budgetFormSchema = z.object({
  category_id: z.string().uuid("Choose an expense category"),
  amount: amountSchema,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  type: transactionTypeSchema,
  icon: z.string().trim().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a hex value" })
    .optional()
    .nullable(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const profileFormSchema = z.object({
  full_name: z.string().trim().max(200).optional().nullable(),
  avatar_url: z.string().url("Avatar must be a valid URL").optional().nullable().or(z.literal("")),
  currency: z.string().default("INR"),
  date_format: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  theme: z.enum(["dark", "light"]),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string().min(1, "Confirm your new password"),
}).refine((v) => v.password === v.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

export const updatePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string().min(1, "Confirm your new password"),
}).refine((v) => v.password === v.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});
