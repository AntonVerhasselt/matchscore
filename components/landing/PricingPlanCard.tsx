import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";

type PricingPlanCardProps = {
  title: string;
  price: string;
  priceSuffix: string;
  priceNote: string;
  features: string[];
  cta: string;
  badge?: string;
  highlighted?: boolean;
  variant?: "default" | "outline";
};

export function PricingPlanCard({
  title,
  price,
  priceSuffix,
  priceNote,
  features,
  cta,
  badge,
  highlighted = false,
  variant = "default",
}: PricingPlanCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col border-border/80 dark:border-border",
        highlighted &&
          "border-sidebar-primary shadow-lg ring-1 ring-sidebar-primary/25 dark:bg-card",
      )}
    >
      <CardHeader className="gap-3 p-4 pb-0 sm:p-6">
        <div className="flex h-8 items-center justify-center">
          {badge ? (
            <Badge className="bg-sidebar-primary text-sidebar-primary-foreground">
              {badge}
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-4 pt-2 sm:px-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
            <span className="font-heading text-3xl tracking-tight sm:text-4xl">
              {price}
            </span>
            <span className="text-sm text-muted-foreground sm:text-base">
              {priceSuffix}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            {priceNote}
          </p>
        </div>
        <ul className="mt-6 flex-1 space-y-2.5 sm:mt-8 sm:space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm sm:text-[0.9375rem]">
              <Check className="mt-0.5 size-4 shrink-0 text-sidebar-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="mt-auto border-t-0 bg-transparent px-4 pt-4 pb-4 sm:px-6 sm:pt-6 sm:pb-6">
        <Button
          variant={variant === "outline" ? "outline" : "default"}
          className={cn(
            "h-12 w-full text-base",
            highlighted &&
              "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
          )}
          asChild
        >
          <Link href="/sign-in">{cta}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
