import { createFileRoute } from "@tanstack/react-router";
import { MockRejected } from "@/mock/MockViews";

export const Route = createFileRoute("/rejected")({
  component: RejectedPage,
});

function RejectedPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <MockRejected />
    </div>
  );
}
