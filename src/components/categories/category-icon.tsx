import {
  Baby,
  BookOpen,
  Briefcase,
  Car,
  Clapperboard,
  Coffee,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  PawPrint,
  Plane,
  Receipt,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The fixed list of icons a category can use. Stored in the DB as the
 * icon NAME string (never the component), so other surfaces can render
 * the same icon from the row alone. The first 16 are the icons of the
 * seeded system categories; the rest are extras for custom categories.
 */
export const CATEGORY_ICONS = [
  "UtensilsCrossed",
  "ShoppingBag",
  "Car",
  "Clapperboard",
  "Receipt",
  "HeartPulse",
  "GraduationCap",
  "Plane",
  "Sparkles",
  "MoreHorizontal",
  "Briefcase",
  "Laptop",
  "Store",
  "TrendingUp",
  "Gift",
  "Wallet",
  "Coffee",
  "Home",
  "Dumbbell",
  "BookOpen",
  "PawPrint",
  "Baby",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICONS)[number];

const ICON_MAP: Record<CategoryIconName, LucideIcon> = {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Clapperboard,
  Receipt,
  HeartPulse,
  GraduationCap,
  Plane,
  Sparkles,
  MoreHorizontal,
  Briefcase,
  Laptop,
  Store,
  TrendingUp,
  Gift,
  Wallet,
  Coffee,
  Home,
  Dumbbell,
  BookOpen,
  PawPrint,
  Baby,
};

interface CategoryIconProps {
  /** Icon name stored on the category row; unknown/null falls back. */
  name?: string | null;
  className?: string;
  /** Optional tint, usually the category color. */
  color?: string | null;
}

/** Render a category's stored icon name as a Lucide icon. */
export function CategoryIcon({ name, className, color }: CategoryIconProps) {
  const Icon: LucideIcon =
    name != null && name in ICON_MAP
      ? ICON_MAP[name as CategoryIconName]
      : MoreHorizontal;
  return (
    <Icon
      className={className}
      style={color ? { color } : undefined}
      aria-hidden="true"
    />
  );
}
