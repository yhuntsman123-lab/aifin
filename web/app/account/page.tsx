import EntitlementCard from "../../components/account/EntitlementCard";
import ThemeToggle from "../../components/theme/ThemeToggle";

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6 text-slate-900 dark:text-slate-100">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">账户中心</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            查看权益等级、到期时间、今日剩余查询次数，并进行续费。
          </p>
        </div>
        <ThemeToggle />
      </header>

      <EntitlementCard />
    </main>
  );
}

