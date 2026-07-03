import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Flame, Wallet, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { adminDashboard } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const fn = useServerFn(adminDashboard);
  const q = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => fn(),
    refetchInterval: 15_000,
  });

  const s = q.data;
  const stats = [
    { label: "Total Users", value: s?.totalUsers ?? 0, icon: Users, color: "text-blue-400" },
    { label: "Ads Watched", value: s?.totalAds ?? 0, icon: Flame, color: "text-orange-400" },
    { label: "Flames Paid", value: (s?.totalFlamesPaid ?? 0).toLocaleString(), icon: Flame, color: "text-primary" },
    { label: "USDT Paid", value: (s?.totalUsdtPaid ?? 0).toFixed(2), icon: DollarSign, color: "text-emerald-400" },
    { label: "USDT Pending", value: (s?.totalUsdtPending ?? 0).toFixed(2), icon: Clock, color: "text-yellow-400" },
    { label: "Approved Tasks", value: s?.approvedTasks ?? 0, icon: CheckCircle2, color: "text-green-400" },
    { label: "Pending Withdrawals", value: s?.pendingWithdrawals ?? 0, icon: Wallet, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Live metrics — refreshes every 15s</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((st) => {
          const Icon = st.icon;
          return (
            <div key={st.label} className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${st.color}`} />
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{st.label}</div>
              </div>
              <div className="mt-2 text-2xl font-black">{st.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
