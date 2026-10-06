import { createFileRoute } from "@tanstack/react-router";
import { PendingPage } from "@/features/pending/PendingPage";

export const Route = createFileRoute("/pending")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <PendingPage />
    </div>
  );
}
