"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    import("@/lib/firebase").then(({ initAnalytics }) => {
      initAnalytics().catch((err) => console.warn("Erro ao iniciar Firebase Analytics:", err));
    });
  }, []);

  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
