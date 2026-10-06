import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MockGraph } from "@/mock/MockViews";
import { MOCK_CATEGORIES } from "@/mock/mock-data";

export const Route = createFileRoute("/graph")({
  component: GraphPage,
});

function GraphPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <MockGraph
        categories={MOCK_CATEGORIES}
        onOpenCard={() => navigate({ to: "/c/$slug", params: { slug: "agent-kit" } })}
      />
    </div>
  );
}
