import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser } from "../../../../lib/server/request-auth";
import { verifyTurnstileToken } from "../../../../lib/security/turnstile";
import { recordRiskSignal } from "../../../../lib/security/risk";

export const runtime = "nodejs";

const PRICE_MAPPING = {
  vip_30d: process.env.STRIPE_PRICE_ID_VIP_30D || "",
  svip_365d: process.env.STRIPE_PRICE_ID_SVIP_365D || "",
} as const;

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY 未配置");
  }
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json()) as {
      productCode: keyof typeof PRICE_MAPPING;
      turnstileToken?: string;
    };
    const productCode = body.productCode;
    if (!productCode || !PRICE_MAPPING[productCode]) {
      return NextResponse.json({ error: "无效的商品编码" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const passCaptcha = await verifyTurnstileToken({
      token: body.turnstileToken,
      remoteIp: ip,
    });
    if (!passCaptcha) {
      await recordRiskSignal({
        userId: user.id,
        ip,
        eventType: "checkout_turnstile_failed",
        eventScore: 4,
      });
      return NextResponse.json({ error: "人机验证失败" }, { status: 400 });
    }

    const stripe = getStripeClient();
    const paymentMethodTypes = (process.env.STRIPE_PAYMENT_METHOD_TYPES || "card,alipay,wechat_pay")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const appBase = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: PRICE_MAPPING[productCode], quantity: 1 }],
      success_url: `${appBase}/account?pay=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/account?pay=cancel`,
      locale: "zh",
      payment_method_types: paymentMethodTypes as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      metadata: {
        user_id: user.id,
        product_code: productCode,
      },
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建支付会话失败" },
      { status: 500 },
    );
  }
}
