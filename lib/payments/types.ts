/**
 * Laster Payment Service (LPS)
 *
 * Provider-independent contract for customer payments,
 * driver payouts, and payment-provider events.
 */

export type CurrencyCode = string; // ISO 4217, e.g. "USD"

export type Money = {
  amountMinor: number; // Integer cents, never floating-point dollars
  currency: CurrencyCode;
};

export type PaymentMethodValidationStatus =
  | 'valid'
  | 'invalid'
  | 'requires_action'
  | 'unknown';

export type PaymentStatus =
  | 'requires_payment_method'
  | 'requires_authorization'
  | 'authorized'
  | 'capture_pending'
  | 'captured'
  | 'cancel_pending'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'unknown';

export type DriverPayoutReadiness =
  | 'ready'
  | 'onboarding_required'
  | 'restricted'
  | 'unknown';

export type PayoutStatus =
  | 'pending'
  | 'in_transit'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'unknown';

export type OperationResult<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

export type CustomerPaymentMethodValidation = {
  status: PaymentMethodValidationStatus;
};

export type CustomerPaymentAuthorization = {
  paymentId: string;
  status: PaymentStatus;
  authorizedAmount?: Money;
};

export type CustomerPaymentFinalization = {
  paymentId: string;
  status: PaymentStatus;
  capturedAmount?: Money;
};

export type CustomerPaymentCancellation = {
  paymentId: string;
  status: PaymentStatus;
};

export type CustomerPaymentRefund = {
  paymentId: string;
  status: PaymentStatus;
  refundedAmount?: Money;
};

export type CustomerPaymentStatusResult = {
  paymentId: string;
  status: PaymentStatus;
  authorizedAmount?: Money;
  capturedAmount?: Money;
  refundedAmount?: Money;
};

export type DriverPayoutVerification = {
  driverId: string;
  status: DriverPayoutReadiness;
};

export type DriverPayoutExecution = {
  payoutId: string;
  status: PayoutStatus;
  amount: Money;
};

export type ProviderEvent = {
  providerEventId: string;
  eventType: string;
  occurredAt?: string;
  payload: unknown;
};

export type ProviderEventResult = {
  processed: boolean;
  duplicate: boolean;
};

export interface LasterPaymentService {
  validateCustomerPaymentMethod(input: {
    customerId: string;
    paymentMethodId: string;
  }): Promise<OperationResult<CustomerPaymentMethodValidation>>;

  authorizeCustomerPaymentAmount(input: {
    tripId: string;
    customerId: string;
    paymentMethodId: string;
    amount: Money;
    idempotencyKey: string;
  }): Promise<OperationResult<CustomerPaymentAuthorization>>;

  finalizeCustomerPaymentAmount(input: {
    paymentId: string;
    finalAmount: Money;
    idempotencyKey: string;
  }): Promise<OperationResult<CustomerPaymentFinalization>>;

  cancelCustomerPaymentAmount(input: {
    paymentId: string;
    amount?: Money;
    idempotencyKey: string;
  }): Promise<OperationResult<CustomerPaymentCancellation>>;

  refundCustomerPaymentAmount(input: {
    paymentId: string;
    amount: Money;
    reason?: string;
    idempotencyKey: string;
  }): Promise<OperationResult<CustomerPaymentRefund>>;

  getCustomerPaymentStatus(input: {
    paymentId: string;
  }): Promise<OperationResult<CustomerPaymentStatusResult>>;

  verifyDriverPayoutMethod(input: {
    driverId: string;
  }): Promise<OperationResult<DriverPayoutVerification>>;

  executeDriverPayoutMethod(input: {
    driverId: string;
    tripId: string;
    amount: Money;
    idempotencyKey: string;
  }): Promise<OperationResult<DriverPayoutExecution>>;

  processProviderEvent(input: {
    event: ProviderEvent;
  }): Promise<OperationResult<ProviderEventResult>>;
}