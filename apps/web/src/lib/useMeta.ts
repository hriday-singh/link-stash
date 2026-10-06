import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import { queryKeys } from "@/api/keys";

export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta(),
    queryFn: () => unwrap(api.GET("/api/meta")),
    staleTime: 1000 * 30,
  });
}

/** Empty-state copy when the library has sources but /stash hasn't turned any into cards yet. */
export function useUntriagedHint(): { message: string; subtext: string } | null {
  const counts = useMeta().data?.counts;
  if (!counts || counts.cards > 0 || counts.sources === 0) return null;
  return {
    message: `${counts.sources} source${counts.sources === 1 ? "" : "s"} waiting for triage`,
    subtext: "Run /stash in Claude Code or agy to turn them into cards and categories.",
  };
}
