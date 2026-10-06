import { createFileRoute } from "@tanstack/react-router";
import { SourceDetailPage } from "@/features/sources/SourceDetailPage";

export const Route = createFileRoute("/s/$sourceId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <SourceDetailPage />
    </div>
  );
}
