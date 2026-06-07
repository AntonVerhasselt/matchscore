import PublicHeader from "@/components/PublicHeader";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden">
      <PublicHeader theme="brand" />
      {children}
    </div>
  );
}
