import AppShell from "../../components/layout/AppShell";
import AccountActions from "../../components/account/AccountActions";
import EntitlementCard from "../../components/account/EntitlementCard";
import InviteCard from "../../components/account/InviteCard";
import OrderHistoryCard from "../../components/account/OrderHistoryCard";

export default function AccountPage() {
  return (
    <AppShell
      title="账户中心"
      subtitle="查看 FREE/VIP/SVIP 权益、到期时间、今日次数与支付记录。"
      rightSlot={<AccountActions />}
    >
      <div className="space-y-4">
        <EntitlementCard />
        <OrderHistoryCard />
        <InviteCard />
      </div>
    </AppShell>
  );
}
