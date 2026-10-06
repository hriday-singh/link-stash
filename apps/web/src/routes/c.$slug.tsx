import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MockCard } from "@/mock/MockCard";

export const Route = createFileRoute("/c/$slug")({
  component: CardPage,
});

function CardPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <MockCard
        onBack={() => navigate({ to: "/" })}
        onReject={() => navigate({ to: "/rejected" })}
      />
    </div>
  );
}
