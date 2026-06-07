import { v } from "convex/values";

export const localeValidator = v.union(
  v.literal("nl"),
  v.literal("fr"),
  v.literal("en"),
  v.literal("de"),
);

export type AppLocale = "nl" | "fr" | "en" | "de";

export const defaultEmailLocale: AppLocale = "nl";
