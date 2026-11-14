/**
 * Hisab database types — hand-written to match
 * supabase/migrations/20261114000001_init.sql.
 * (Generate from a live project later with `supabase gen types` and
 * replace this file; the shape is kept compatible.)
 */

export type TransactionType = "income" | "expense";
export type ThemePreference = "dark" | "light";
export type CurrencyCode = "INR";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

/**
 * NOTE: these are `type` aliases, not `interface`s, deliberately.
 * supabase-js requires each table's Row/Insert/Update to extend
 * `Record<string, unknown>`, and a TS `interface` has no implicit
 * index signature, so interfaces fail that check and every query
 * result collapses to `never`. Object type literals carry the
 * implicit index signature, so they satisfy it. Do not convert
 * these back to interfaces.
 */
export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  date_format: DateFormat;
  theme: ThemePreference;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string | null;
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  /** NUMERIC(12,2) — may arrive as number or string from PostgREST. */
  amount: number | string;
  type: TransactionType;
  payment_method: string | null;
  /** YYYY-MM-DD */
  transaction_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined category, when the query selects it. */
  category?: Pick<Category, "id" | "name" | "type" | "icon" | "color"> | null;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number | string;
  month: number;
  year: number;
  created_at: string;
  category?: Pick<Category, "id" | "name" | "type" | "icon" | "color"> | null;
};

/** Budget joined with its computed spend for the month. */
export type BudgetWithSpend = Budget & {
  spent: number;
  remaining: number;
  utilization: number;
  status: "ok" | "warning" | "exceeded";
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> &
          Partial<Pick<Profile, "created_at" | "updated_at">>;
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at"> &
          Partial<Pick<Category, "id" | "created_at">>;
        Update: Partial<Omit<Category, "id">>;
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at" | "updated_at" | "category"> &
          Partial<Pick<Transaction, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<Transaction, "id" | "category">>;
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: Budget;
        Insert: Omit<Budget, "id" | "created_at" | "category"> &
          Partial<Pick<Budget, "id" | "created_at">>;
        Update: Partial<Omit<Budget, "id" | "category">>;
        Relationships: [
          {
            foreignKeyName: "budgets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
