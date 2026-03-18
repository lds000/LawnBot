import { useQuery } from "@tanstack/react-query";
import { getHistory } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { CheckCircle2, XCircle, User, Clock } from "lucide-react";

export function History() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => getHistory(100),
    refetchInterval: 10000,
  });

  if (isLoading) return <div className="text-gray-400">Loading history…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Watering History</h1>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Zone</th>
              <th className="text-left px-4 py-3">Started</th>
              <th className="text-left px-4 py-3">Duration</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(history as any[]).map((h: any) => (
              <tr key={h.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-medium">{h.set_name}</td>
                <td className="px-4 py-3 text-gray-400">{formatDateTime(h.start_time)}</td>
                <td className="px-4 py-3 text-gray-400">
                  {h.duration_seconds ? formatDuration(h.duration_seconds) : "—"}
                </td>
                <td className="px-4 py-3">
                  {h.is_manual ? (
                    <span className="badge-blue"><User className="w-3 h-3 mr-1" />Manual</span>
                  ) : (
                    <span className="badge-gray"><Clock className="w-3 h-3 mr-1" />Scheduled</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {h.completed ? (
                    <span className="badge-green"><CheckCircle2 className="w-3 h-3 mr-1" />Done</span>
                  ) : (
                    <span className="badge-yellow"><XCircle className="w-3 h-3 mr-1" />Interrupted</span>
                  )}
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No watering history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
