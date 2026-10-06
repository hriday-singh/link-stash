import * as React from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  MoreVerticalIcon,
  LinkSquare02Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  Delete02Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { api, ApiError, unwrap, type CardDetail } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryPill } from "@/components/CategoryPill";
import { KIND_ICON, type Kind } from "@/lib/kinds";
import { CardBody } from "./CardBody";
import { NotesEditor } from "./NotesEditor";
import { ConflictBanner } from "./ConflictBanner";
import { RejectDialog } from "./RejectDialog";
import { useCardSave } from "./useCardSave";
import { reconcile } from "./reconcile";
import { PropertiesForm } from "@/features/properties/PropertiesForm";
import { LinkPanels } from "@/features/properties/LinkPanels";
import { LocalGraph } from "@/features/graph/LocalGraph";

export function CardPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isNotesDirty, setIsNotesDirty] = React.useState(false);
  const [isRejectOpen, setIsRejectOpen] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // 1. Fetch card details
  const {
    data: cardDetail,
    isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery<CardDetail>({
    queryKey: queryKeys.card(slug),
    queryFn: async () => {
      return await unwrap(
        api.GET("/api/cards/{slug}", {
          params: { path: { slug } },
        })
      );
    },
    enabled: Boolean(slug),
  });

  // 2. Fetch connections (backlinks, mentions, outgoing)
  const { data: links, isLoading: isLinksLoading } = useQuery({
    queryKey: queryKeys.cardLinks(slug),
    queryFn: async () => {
      return await unwrap(
        api.GET("/api/cards/{slug}/links", {
          params: { path: { slug } },
        })
      );
    },
    enabled: Boolean(cardDetail && slug),
  });

  // 3. Fetch categories and tags metadata
  const { data: meta } = useQuery({
    queryKey: queryKeys.meta(),
    queryFn: async () => {
      return await unwrap(api.GET("/api/meta"));
    },
  });

  // 4. Save hook managing sequential saves, hashing, and 409 conflict
  const cardSave = useCardSave({
    slug,
    initialHash: cardDetail?.hash ?? "",
    onSaveSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.card(slug), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.cards() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cardLinks(slug) });
      setFieldErrors({});
    },
    onReloadRequest: () => {
      void refetch();
      setIsNotesDirty(false);
    },
  });

  // Detect server changes vs local state
  React.useEffect(() => {
    if (!cardDetail) return;
    const action = reconcile({
      serverHash: cardDetail.hash,
      lastSavedHash: cardSave.lastSavedHash,
      baseHash: cardSave.baseHash,
      isDirty: isNotesDirty,
    });

    if (action === "reload") {
      cardSave.reload();
    }
  }, [cardDetail, cardSave, isNotesDirty]);

  // Reject action handler
  const handleReject = async (reason: string) => {
    try {
      setIsRejecting(true);
      await unwrap(
        api.DELETE("/api/cards/{slug}", {
          params: { path: { slug } },
          body: { reason },
        })
      );
      toast.success("Card rejected and moved to log");
      setIsRejectOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.cards() });
      queryClient.invalidateQueries({ queryKey: queryKeys.rejects() });
      queryClient.invalidateQueries({ queryKey: queryKeys.meta() });
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject card";
      toast.error(msg);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleFieldSave = async (patch: {
    category?: string;
    kind?: Kind;
    tags?: string[];
  }) => {
    try {
      setFieldErrors({});
      await cardSave.save(patch);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const details = err.details as { fields?: Record<string, string> } | undefined;
        if (details?.fields) {
          setFieldErrors(details.fields);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Failed to save properties");
      }
    }
  };

  const categoryMeta = meta?.categories.find(
    (c) => c.name === cardDetail?.card.category
  );
  const categoryColor = categoryMeta?.color || cardDetail?.card.category || "models";

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8 space-y-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded-md" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-10 w-3/4 bg-muted animate-pulse rounded-md" />
            <div className="h-40 w-full bg-muted/60 animate-pulse rounded-lg" />
            <div className="h-32 w-full bg-muted/40 animate-pulse rounded-lg" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <div className="h-64 w-full bg-muted/40 animate-pulse rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !cardDetail) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <HugeiconsIcon icon={Alert02Icon} className="size-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Card Not Found</h2>
        <p className="text-xs text-muted-foreground">
          {loadError instanceof Error ? loadError.message : "The card could not be loaded."}
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/" })}>
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-3.5 mr-1.5" />
          Back to Feed
        </Button>
      </div>
    );
  }

  const KindIcon = KIND_ICON[cardDetail.card.kind as Kind] || KIND_ICON.repo;
  const cardSlug = cardDetail.slug ?? slug;
  const transitionName = `card-${cardSlug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8 space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div
        data-testid="card-page-header"
        style={{ viewTransitionName: transitionName } as React.CSSProperties}
        className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/" })}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Back to feed"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" strokeWidth={2} />
          </Button>

          <div className="flex items-center gap-2 truncate">
            <CategoryPill name={cardDetail.card.category} color={categoryColor} />
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <HugeiconsIcon icon={KindIcon} className="size-3" />
              <span className="capitalize">{cardDetail.card.kind}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Status Indicator */}
          {cardSave.status === "saving" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" />
              Saving…
            </span>
          )}
          {cardSave.status === "saved" && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
              Saved
            </span>
          )}

          {cardDetail.card.url && (
            <a
              href={cardDetail.card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <span>Visit Link</span>
              <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5 text-muted-foreground" />
            </a>
          )}

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="More card actions"
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setIsRejectOpen(true)}
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5 mr-1" />
                Reject Card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 409 Conflict Banner */}
      {cardSave.status === "conflict" && (
        <ConflictBanner
          onReload={cardSave.reload}
          onKeepMine={cardSave.keepMine}
          isSaving={false}
        />
      )}

      {/* Main Grid: Body/Notes on left, Properties & Links on right */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left column (Body + Notes) */}
        <div className="space-y-8 lg:col-span-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {cardDetail.card.title}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground select-all">
              {cardDetail.card.key}
            </p>
          </div>

          {/* Read-Only Markdown Body */}
          <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs">
            <CardBody body={cardDetail.body} resolved={cardDetail.resolved} />
          </div>

          {/* Notes Section with CodeMirror 6 */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-foreground">Notes</h2>
              <span className="text-[11px] text-muted-foreground">
                Private notes • Autosaves after 800ms • Link with [[slug]]
              </span>
            </div>

            <NotesEditor
              initialValue={cardDetail.notes}
              onSave={async (notes) => {
                await cardSave.save({ notes });
              }}
              onDirtyChange={setIsNotesDirty}
            />
          </div>
        </div>

        {/* Right column (Properties + Links) */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Properties
            </h3>

            <PropertiesForm
              card={cardDetail.card}
              categories={meta?.categories}
              suggestedTags={meta?.tags?.map((t) => t.tag)}
              onSaveField={async (patch) => {
                await handleFieldSave(patch);
              }}
              fieldErrors={fieldErrors}
              disabled={cardSave.status === "saving"}
            />
          </div>

            {/* Local Neighborhood Graph */}
            <LocalGraph slug={slug} />

            {/* Connections Panels: Backlinks, Mentioned by, Outgoing */}
            <LinkPanels links={links} isLoading={isLinksLoading} />
          </div>
        </div>

        {/* Reject Confirmation Dialog */}
      <RejectDialog
        open={isRejectOpen}
        onOpenChange={setIsRejectOpen}
        cardTitle={cardDetail.card.title}
        onConfirmReject={handleReject}
        isRejecting={isRejecting}
      />
    </div>
  );
}
