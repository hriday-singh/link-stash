import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MockSources } from "@/mock/MockViews";

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
});

function SourcesPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <MockSources
        onOpenCard={() => navigate({ to: "/c/$slug", params: { slug: "agent-kit" } })}
      />
    </div>
  );
}
