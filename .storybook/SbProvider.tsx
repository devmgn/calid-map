import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import { QUERY_CLIENT_CONFIG } from "../src/config/queryClientConfig";
import "../src/lib/styles/globals.css";

export function SbProvider({ children }: React.PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient(QUERY_CLIENT_CONFIG));

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        fallbackRender={(props) => {
          const { error, resetErrorBoundary } = props;
          return (
            <>
              <h1 className="text-2xl font-bold">Something went wrong:</h1>
              {Error.isError(error) && (
                <p className="mt-4 text-red-600">{error.message}</p>
              )}
              <button className="mt-4" type="button" onClick={resetErrorBoundary}>
                Try again
              </button>
            </>
          );
        }}
      >
        <Suspense fallback="loading...">{children}</Suspense>
      </ErrorBoundary>
      <Toaster richColors closeButton />
    </QueryClientProvider>
  );
}
