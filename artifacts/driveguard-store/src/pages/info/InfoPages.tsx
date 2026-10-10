import type { StoreSettings } from '@workspace/api-client-react';
import { money } from '@/lib-store';
import { BackToShop, ContactLink, InfoPage } from '@/components/store/InfoPage';

type P = { settings: StoreSettings };
const brandOf = (s: StoreSettings) => s.brandName || 'DriveGuard';
const Unpublished = ({ what }: { what: string }) => <>Support contact details are not published yet, so {what} cannot be sent from this site for now.</>;

export function AboutPage({ settings }: P) {
  const b = brandOf(settings);
  return <InfoPage eyebrow="About" title={`About ${b}`} intro={`${b} brings cameras and everyday essentials together in one shop.`}
    meta={{ title: `About | ${b}`, description: `${b} sells cameras and everyday essentials. Learn what the store offers.` }}
    sections={[
      { id: 'cameras', heading: 'Cameras', body: <p>Explore our camera collection. Each product page lists its price, photos, description and current stock.</p> },
      { id: 'essentials', heading: 'Everyday essentials', body: <p>Alongside cameras we stock everyday essentials, browsable by category from the navigation above.</p> },
      { id: 'shopping', heading: 'Shopping here', body: <p>Add items to your cart or use Buy now to go straight to checkout. Questions about an order are best raised through the Contact page. <BackToShop />.</p> },
    ]} />;
}

export function ContactPage({ settings }: P) {
  const b = brandOf(settings);
  const email = settings.supportEmail;
  return <InfoPage eyebrow="Contact" title="Contact support" intro="Help with an order, a product question or a correction to something you have seen on the site."
    meta={{ title: `Contact | ${b}`, description: `How to reach ${b} support about orders, products and privacy questions.` }}
    sections={[
      { id: 'reach', heading: 'How to reach us', body: email
        ? <p>Email <ContactLink email={email} subject="Order help" /> and include your name and the products involved.</p>
        : <p>Support contact details are not published yet. No email address, phone number or postal address is listed for this store, and this page does not send messages.</p> },
      { id: 'include', heading: 'What to include', body: <ul className="list-disc space-y-1 pl-5"><li>The product names and quantities</li><li>The name and contact details used at checkout</li><li>What you need: help, a correction, or a privacy question</li></ul> },
      { id: 'topics', heading: 'Topics we can help with', body: <p>Order help, delivery and return questions, price or availability corrections, and privacy inquiries. {email ? <>Privacy inquiries can use <ContactLink email={email} subject="Privacy inquiry" label="the same address" />.</> : <Unpublished what="privacy inquiries" />}</p> },
    ]} />;
}

export function ShippingReturnsPage({ settings }: P) {
  const b = brandOf(settings);
  const email = settings.supportEmail;
  return <InfoPage eyebrow="Shipping and returns" title="Shipping and returns" intro="What the store shows at checkout, and how to ask about delivery or returns."
    meta={{ title: `Shipping & Returns | ${b}`, description: `Shipping charges and return enquiries for ${b}.` }}
    sections={[
      { id: 'shipping-cost', heading: 'Shipping charge', body: <p>The current flat shipping charge is <strong className="text-foreground">{money(settings.shippingCents)}</strong>. Your cart and checkout show the exact amount before you place an order.</p> },
      { id: 'delivery', heading: 'Delivery', body: <p>We do not publish guaranteed delivery dates or a list of delivery areas here. Please confirm delivery timing and whether we can deliver to your address with support before ordering.</p> },
      { id: 'returns', heading: 'Returns', body: <p>No fixed return or refund window is stated on this site. Return and refund requests are reviewed individually, and asking does not guarantee approval.</p> },
      { id: 'ask', heading: 'Ask about an order', body: email ? <p>Email <ContactLink email={email} subject="Order help" /> with your order details.</p> : <p><Unpublished what="delivery or return requests" /></p> },
    ]} />;
}

export function PrivacyPage({ settings }: P) {
  const b = brandOf(settings);
  const email = settings.supportEmail;
  return <InfoPage eyebrow="Privacy" title="Privacy" intro="What this site stores and who can see it, in plain terms."
    meta={{ title: `Privacy | ${b}`, description: `What ${b} stores in your browser and when you check out.` }}
    sections={[
      { id: 'browser', heading: 'In your browser', body: <p>Your cart is saved in your browser&rsquo;s local storage so it is still there when you return. Clearing your browser data removes it.</p> },
      { id: 'cookies', heading: 'Account and session cookies', body: <p>Sign-in for administrators uses account and session cookies. Browsing the store does not require an account.</p> },
      { id: 'checkout', heading: 'Checkout information', body: <p>At checkout you enter contact details, shipping and billing addresses and order details. Information you enter during checkout, including while you are still filling in the form, may be retained in order and live records. Authorized store administrators can review these records.</p> },
      { id: 'providers', heading: 'Service providers', body: <p>The site relies on service providers for hosting, sign-in and operation. Information may be processed by these providers to operate the site.</p> },
      { id: 'retention', heading: 'Retention and questions', body: <p>A fixed retention period is not published here. Contact the team with questions about stored information or to request its removal; a request does not automatically delete records. {email ? <>For privacy inquiries email <ContactLink email={email} subject="Privacy inquiry" />.</> : <Unpublished what="privacy inquiries" />}</p> },
    ]} />;
}

export function TermsPage({ settings }: P) {
  const b = brandOf(settings);
  const email = settings.supportEmail;
  return <InfoPage eyebrow="Terms" title="Terms of use" intro={`The basic terms for using the ${b} store.`}
    meta={{ title: `Terms | ${b}`, description: `Terms for browsing and ordering from ${b}.` }}
    sections={[
      { id: 'pricing', heading: 'Prices and availability', body: <p>We aim to keep prices, descriptions and stock accurate, but errors can occur. Availability can change, and an item may become unavailable after being added to your cart.</p> },
      { id: 'orders', heading: 'Placing an order', body: <p>Entering details at checkout alone does not confirm payment or dispatch. An order is only confirmed once the store has confirmed it.</p> },
      { id: 'corrections', heading: 'Corrections and support', body: <p>If you spot a mistake or need help, contact the team. {email ? <>Write to <ContactLink email={email} subject="Order help" />.</> : <Unpublished what="corrections" />}</p> },
      { id: 'changes', heading: 'Changes', body: <p>These terms and the store content may be updated from time to time.</p> },
    ]} />;
}
