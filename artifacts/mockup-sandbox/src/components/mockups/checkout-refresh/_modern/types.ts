export type OrderAddress = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: 'US' | 'CA';
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: 'front' | 'dual';
  priceCents: number;
  stock: number;
  imageUrl: string;
};

export type StoreSettings = {
  brandName: string;
  trustDescription: string;
  supportEmail: string;
  shippingCents: number;
  shippingThresholdCents: number;
  fictionalDemoMode: boolean;
  verificationTitle?: string;
  verificationMerchantName?: string;
  verificationCountry?: string;
  verificationPrompt?: string;
  verificationEmailLabel?: string;
  verificationPhoneLabel?: string;
  verificationNextLabel?: string;
  verificationAccentColor?: string;
  verificationButtonColor?: string;
};

export type DemoCheckoutDraftInput = {
  displayName?: string;
  cardType?: 'credit' | 'debit';
  completedFields: ('name' | 'number' | 'expiry' | 'cvc')[];
  billingAddress?: OrderAddress;
  demoCardNumber?: string;
  demoExpiry?: string;
  demoCvc?: string;
};