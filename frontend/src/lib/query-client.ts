import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function clearQueryCache() {
  queryClient.clear();
}

export function resetQueryCache() {
  queryClient.resetQueries();
}
