declare module "@paypal/checkout-server-sdk" {
  namespace core {
    class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class PayPalHttpClient {
      constructor(environment: SandboxEnvironment | LiveEnvironment);
      execute(request: any): Promise<any>;
    }
  }
  namespace orders {
    class OrdersCreateRequest {
      prefer(value: string): void;
      requestBody(body: any): void;
    }
    class OrdersCaptureRequest {
      constructor(orderId: string);
      requestBody(body: any): void;
    }
    class OrdersGetRequest {
      constructor(orderId: string);
    }
  }
  export { core, orders };
}
