import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MockCard } from "@/mock/MockCard";
import { MockFeed, MockSidebar } from "@/mock/MockFeed";
import { useTheme } from "@/state/theme";

export function App() {
  const [view, setView] = useState<"feed" | "card">("feed");
  const { resolved, toggle } = useTheme();
  return (
    <div className="flex min-h-dvh">
      <MockSidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <h1 className="mr-auto text-sm font-semibold">Link Stash</h1>
          <Button
            variant={view === "feed" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("feed")}
          >
            Feed
          </Button>
          <Button
            variant={view === "card" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("card")}
          >
            Card page
          </Button>
          <Button variant="outline" size="sm" onClick={toggle}>
            {resolved === "dark" ? "Light" : "Dark"}
          </Button>
        </div>
        {view === "feed" ? <MockFeed /> : <MockCard />}
      </main>
    </div>
  );
}
