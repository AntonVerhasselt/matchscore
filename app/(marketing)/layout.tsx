import { Suspense } from "react";

import PublicHeader from "@/components/PublicHeader";
import { PublicNavbar } from "@/components/PublicNavbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden">
      <Suspense
        fallback={<PublicNavbar authenticated={false} theme="brand" />}
      >
        <PublicHeader theme="brand" />
      </Suspense>
      {children}
    </div>
  );
}
