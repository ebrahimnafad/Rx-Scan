// app/App.tsx
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/app/routes';
import { BranchProvider } from '@/app/providers/BranchProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
    },
  },
});

// Pause all refetch intervals when tab is hidden; resume + refetch when visible.
// Prevents battery drain from background polling.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      queryClient.cancelQueries();
    } else {
      queryClient.refetchQueries();
    }
  });
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BranchProvider>
        <RouterProvider router={router} />
      </BranchProvider>
    </QueryClientProvider>
  );
}
