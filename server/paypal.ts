import paypal from "@paypal/checkout-server-sdk";
import * as db from "./db";

// Get PayPal settings from database
async function getPayPalSettings() {
  const map = await db.getAllSettings();
  return {
    clientId: map["payment.paypalClientId"] || "",
    secret: map["payment.paypalSecret"] || "",
    mode: (map["payment.paypalMode"] || "sandbox") as "sandbox" | "live",
    currency: map["payment.currency"] || "SAR",
    enabled: map["payment.enabled"] === "true",
    cashEnabled: map["payment.cashEnabled"] !== "false",
  };
}

// Create PayPal client dynamically from DB settings
async function getPayPalClient() {
  const settings = await getPayPalSettings();
  if (!settings.clientId || !settings.secret) {
    throw new Error("PayPal credentials not configured. Go to Admin Settings > Payment to set up.");
  }
  const environment = settings.mode === "live"
    ? new paypal.core.LiveEnvironment(settings.clientId, settings.secret)
    : new paypal.core.SandboxEnvironment(settings.clientId, settings.secret);
  return new paypal.core.PayPalHttpClient(environment);
}

export interface CreateOrderParams {
  bookingId: number;
  amount: number; // Total amount in SAR
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export async function createPayPalOrder(params: CreateOrderParams) {
  const client = await getPayPalClient();
  const settings = await getPayPalSettings();

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: `booking-${params.bookingId}`,
      description: params.description,
      amount: {
        currency_code: settings.currency,
        value: params.amount.toFixed(2),
      },
    }],
    application_context: {
      brand_name: "Monthly Key",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  });

  const response = await client.execute(request);
  const order = response.result;

  // Find approval URL
  const approvalUrl = order.links?.find((l: any) => l.rel === "approve")?.href || "";

  return {
    orderId: order.id,
    approvalUrl,
    status: order.status,
  };
}

export async function capturePayPalOrder(orderId: string) {
  const client = await getPayPalClient();

  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({} as any);

  const response = await client.execute(request);
  const capture = response.result;

  const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || "";
  const status = capture.status;
  const amount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || "0";

  return {
    captureId,
    status,
    amount,
    payerEmail: capture.payer?.email_address || "",
    payerId: capture.payer?.payer_id || "",
  };
}

export async function getPayPalOrderDetails(orderId: string) {
  const client = await getPayPalClient();
  const request = new paypal.orders.OrdersGetRequest(orderId);
  const response = await client.execute(request);
  return response.result;
}

export { getPayPalSettings };
