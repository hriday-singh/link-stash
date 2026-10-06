import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";

export function createStashQueryClient(customToast?: (msg: string) => void) {
  const notifyError = customToast ?? ((msg: string) => toast.error(msg));

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "An unexpected error occurred";
        notifyError(message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
            return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function StashQueryProvider({
  children,
  client,
}: {
  children: ReactNode;
  client?: QueryClient;
}) {
  const [queryClient] = useState(() => client ?? createStashQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
