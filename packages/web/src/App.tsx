import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/pages/Dashboard";
import { Schedule } from "@/pages/Schedule";
import { History } from "@/pages/History";
import { Sensors } from "@/pages/Sensors";
import { Settings } from "@/pages/Settings";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQuery } from "@tanstack/react-query";
import { getSensorsLatest } from "@/lib/api";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 5000 } },
});

function AppInner() {
  const { data: status, status: wsStatus } = useWebSocket<any>();
  const { data: sensors } = useQuery({
    queryKey: ["sensors-latest"],
    queryFn: getSensorsLatest,
    refetchInterval: 5000,
  });

  return (
    <BrowserRouter>
      <Navbar wsStatus={wsStatus} />
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-10">
        <Routes>
          <Route path="/" element={<Dashboard status={status} sensors={sensors} />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/history" element={<History />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInner />
    </QueryClientProvider>
  );
}
