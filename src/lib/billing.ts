export interface BillingAvailability {
  checkoutAvailable: boolean;
  portalAvailable: boolean;
}

export const unavailableBilling: BillingAvailability = {
  checkoutAvailable: false,
  portalAvailable: false,
};
