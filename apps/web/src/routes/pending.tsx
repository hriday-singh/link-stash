import { createFileRoute } from "@tanstack/react-router";
import { MockPending } from "@/mock/MockViews";

export const Route = createFileRoute("/pending")({
  component: PendingPage,
});

function PendingPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <MockPending />
    </div>
  );
}
