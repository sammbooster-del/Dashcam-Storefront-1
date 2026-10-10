type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover';

const cardBrands: CardBrand[] = ['visa', 'mastercard', 'amex', 'discover'];
const brandNames: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
};

export function detectCardBrand(value: string): CardBrand | null {
  const digits = value.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^(6011|65|64[4-9]|622(12[6-9]|1[3-9]\d|[2-8]\d{2}|9([01]\d|2[0-5])))/.test(digits)) return 'discover';
  return null;
}

export function CardBrandLogo({ brand }: { brand: CardBrand }) {
  return <svg viewBox="0 0 60 38" width="54" height="34" role="img" aria-label={brandNames[brand]} className="block shrink-0">
    <rect x="0.5" y="0.5" width="59" height="37" rx="5" fill="white" stroke="#dce2e8" />
    {brand === 'visa' && <g transform="translate(6 0) scale(1.95)" fill="#1A1F71"><path d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z" /></g>}
    {brand === 'mastercard' && <><circle cx="24" cy="19" r="11" fill="#EB001B" /><circle cx="36" cy="19" r="11" fill="#F79E1B" /><path d="M30 9.8a11 11 0 0 1 0 18.4 11 11 0 0 1 0-18.4" fill="#FF5F00" /></>}
    {brand === 'amex' && <><rect x="5" y="5" width="50" height="28" rx="2" fill="#2469AD" /><text x="30" y="17" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="900">AMERICAN</text><text x="30" y="28" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="900">EXPRESS</text></>}
    {brand === 'discover' && <><text x="30" y="22" textAnchor="middle" fill="#191919" fontFamily="Arial, sans-serif" fontSize="10.5" fontWeight="900" letterSpacing="-.4">DISCOVER</text><path d="M34 27h15" stroke="#F58220" strokeWidth="2.5" strokeLinecap="round" /></>}
  </svg>;
}

export function AcceptedCards({ location, dark = false }: { location: string; dark?: boolean }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid={`accepted-cards-${location}`}>
    <span className={`text-[11px] font-semibold ${dark ? 'text-[#d2d5d9]' : 'text-[#617080]'}`}>Accepted cards</span>
    <div className="flex flex-wrap gap-1.5" aria-label="Visa, Mastercard, American Express, Discover">
      {cardBrands.map(brand => <CardBrandLogo key={brand} brand={brand} />)}
    </div>
  </div>;
}