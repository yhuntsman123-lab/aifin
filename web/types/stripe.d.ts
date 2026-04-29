declare module "stripe" {
  class Stripe {
    constructor(apiKey: string, config?: Record<string, unknown>);
    checkout: {
      sessions: {
        create(params: Record<string, unknown>): Promise<any>;
      };
    };
    webhooks: {
      constructEvent(payload: string, signature: string, secret: string): any;
    };
  }

  namespace Stripe {
    namespace Checkout {
      namespace SessionCreateParams {
        type PaymentMethodType = string;
      }
      interface Session {
        id: string;
        metadata?: Record<string, string>;
        payment_intent?: string | null | object;
        customer?: string | null | object;
        amount_total?: number | null;
        currency?: string | null;
        mode?: string | null;
        payment_status?: string | null;
      }
    }
  }

  export default Stripe;
}
