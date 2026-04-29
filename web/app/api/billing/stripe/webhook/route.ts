import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase-admin";
import { grantPaidEntitlement } from "../../../../../lib/membership/entitlement-service";
import { tryGrantInviteRewardForFirstPaidUser } from "../../../../../lib/membership/invite-service";

export const runtime = "nodejs";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY 未配置");
  return new Stripe(key);
}

function mapProduct(productCode: string): { tier: "vip" | "svip"; amount: number } | null {
  if (productCode === "vip_30d") return { tier: "vip", amount: 19900 };
  if (productCode === "svip_365d") return { tier: "svip", amount: 199000 };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET 未配置" }, { status: 500 });
    }

    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "缺少 stripe-signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const productCode = session.metadata?.product_code || "";
    const product = mapProduct(productCode);

    if (!userId || !product) {
      return NextResponse.json({ error: "metadata 缺失 user_id/product_code" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id,status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (existingOrder?.id && existingOrder.status === "paid") {
      return NextResponse.json({ received: true, idempotent: true });
    }

    await supabase.from("orders").upsert(
      {
        user_id: userId,
        stripe_session_id: session.id,
        stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        product_code: productCode,
        amount: session.amount_total || product.amount,
        currency: session.currency || "cny",
        status: "paid",
        paid_at: new Date().toISOString(),
        metadata: {
          mode: session.mode,
          payment_status: session.payment_status,
        },
      },
      { onConflict: "stripe_session_id" },
    );

    await grantPaidEntitlement({
      userId,
      tier: product.tier,
      source: "stripe",
      reference: session.id,
    });

    await tryGrantInviteRewardForFirstPaidUser({
      paidUserId: userId,
      reference: `invite_reward:${session.id}`,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "webhook failed" },
      { status: 500 },
    );
  }
}
