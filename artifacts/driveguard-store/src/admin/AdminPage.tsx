import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminOverviewQueryKey,
  getGetAdminSettingsQueryKey,
  getGetStorefrontQueryKey,
  getListAdminDemoDraftsQueryKey,
  getListAdminOrdersQueryKey,
  getListAdminProductsQueryKey,
  useApproveAdminOrderVerification,
  useConfirmAdminCodeShared,
  useCreateAdminProduct,
  useDeleteAdminOrder,
  useDeleteAdminProduct,
  useGetAdminOverview,
  useGetAdminSettings,
  useListAdminDemoDrafts,
  useListAdminOrders,
  useListAdminProducts,
  useDeclineAdminOrderPayment,
  useMarkAdminOrderInvalidOtp,
  useRequestAdminOrderVerification,
  useUpdateAdminOrder,
  useUpdateAdminProduct,
  useUpdateAdminSettings,
} from '@workspace/api-client-react';
import type { DemoCheckoutDraft, DemoOrder, OrderAddress, Product, ProductInput, StoreSettingsInput } from '@workspace/api-client-react';
import {
  ArrowDownRight, ArrowRight, ArrowUp, ArrowDown, Boxes, ChevronDown, ChevronRight,
  CircleAlert, ClipboardList, Eye, EyeOff, ImageOff, LayoutDashboard,
  ImagePlus, Package, Pencil, Plus, RefreshCw, Search, Settings2, ShieldCheck,
   ShoppingBag, Trash2, X, Mail,
} from 'lucide-react';
import { KNOWN_CATEGORY_EXAMPLES, buildCategories, categoryLabel, normalizeCategory, productVisible } from '@/lib-categories';
import './AdminPage.css';
import { CheckoutCountriesEditor } from './CheckoutCountriesEditor';
import { countryName } from '@/lib-countries';
import CustomerEmailDialog from './CustomerEmailDialog';

type Section = 'overview' | 'products' | 'orders' | 'settings';
type ProductDraft = Omit<ProductInput, 'priceCents' | 'stock'> & { price: string; stock: string };
type SettingsDraft = Omit<StoreSettingsInput, 'shippingThresholdCents' | 'shippingCents'> & { shippingThreshold: string; shipping: string };
type Deletion = { kind: 'product' | 'order'; id: number; name: string };
type Notice = { type: 'success' | 'error'; text: string };

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const toCents = (value: string) => Math.round(Number(value) * 100);
const dollars = (cents: number) => (cents / 100).toFixed(2);
const date = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const blankProduct = (): ProductDraft => ({ name: '', slug: '', description: '', imageUrl: '', price: '', stock: '0', category: 'skincare', featured: false, active: true });
const productDraft = (product: Product): ProductDraft => ({
  name: product.name, slug: product.slug, description: product.description, imageUrl: '',
  price: dollars(product.priceCents), stock: String(product.stock), category: product.category,
  featured: product.featured, active: product.active,
});
const settingsDraft = (settings: StoreSettingsInput): SettingsDraft => ({
  brandName: settings.brandName, announcement: settings.announcement, heroTitle: settings.heroTitle,
  heroDescription: settings.heroDescription, heroImageUrl: settings.heroImageUrl,
  trustTitle: settings.trustTitle, trustDescription: settings.trustDescription,
  shippingThreshold: dollars(settings.shippingThresholdCents), shipping: dollars(settings.shippingCents),
  supportEmail: settings.supportEmail,
  shippingCountries: settings.shippingCountries ?? ['US', 'CA'],
  disabledCategories: settings.disabledCategories ?? [],
  orderEmailsEnabled: settings.orderEmailsEnabled ?? false,
  orderEmailFrom: settings.orderEmailFrom ?? '',
  orderEmailTeam: settings.orderEmailTeam ?? '',
  fictionalDemoMode: settings.fictionalDemoMode,
  verificationTitle: settings.verificationTitle,
  verificationMerchantName: settings.verificationMerchantName,
  verificationCountry: settings.verificationCountry,
  verificationPrompt: settings.verificationPrompt,
  verificationEmailLabel: settings.verificationEmailLabel,
  verificationPhoneLabel: settings.verificationPhoneLabel,
  verificationNextLabel: settings.verificationNextLabel,
  verificationAccentColor: settings.verificationAccentColor,
  verificationButtonColor: settings.verificationButtonColor,
});
const orderLabel = (order: DemoOrder) => order.items.map(item => `${item.name} × ${item.quantity}`).join(', ');

function Field({ label, name, value, onChange, type = 'text', placeholder, required, maxLength, hint, min, step }: {
  label: string; name: string; value: string; onChange: (value: string) => void; type?: string;
  placeholder?: string; required?: boolean; maxLength?: number; hint?: string; min?: string; step?: string;
}) {
  return <label className="dg-field">{label}
    <input name={name} data-testid={`input-admin-${name}`} type={type} value={value} required={required} maxLength={maxLength}
      min={min} step={step} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    {hint && <small>{hint}</small>}
  </label>;
}

function MoneyField({ label, name, value, onChange, max }: { label: string; name: string; value: string; onChange: (value: string) => void; max?: number }) {
  return <label className="dg-field">{label}<span className="dg-money-field"><span>$</span>
    <input name={name} data-testid={`input-admin-${name}`} type="number" min="0" max={max} step="0.01" required value={value} onChange={event => onChange(event.target.value)} />
  </span></label>;
}

function Switch({ checked, onChange, label, detail, id, disabled }: { checked: boolean; onChange: () => void; label: string; detail: string; id: string; disabled?: boolean }) {
  return <div className="dg-switch-line"><div><strong>{label}</strong><small>{detail}</small></div>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={onChange} className="dg-switch" data-testid={`switch-admin-${id}`} /></div>;
}

function ProductImage({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return <span className="dg-thumb">{url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : <ImageOff size={18} aria-label={`No image for ${name}`} />}</span>;
}

type EditorImage = {
  id: string;
  url: string;
  preview?: string;
  file?: File;
  name: string;
  status: 'ready' | 'uploading' | 'error';
  progress: number;
  error?: string;
};
const MAX_PRODUCT_IMAGES = 15;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const initialProductImages = (product: Product | null): EditorImage[] => {
  if (!product) return [];
  const urls = (product as Product & { imageUrls?: string[] }).imageUrls;
  return (Array.isArray(urls) && urls.length ? urls : product.imageUrl ? [product.imageUrl] : [])
    .filter((url): url is string => typeof url === 'string' && !!url.trim())
    .slice(0, MAX_PRODUCT_IMAGES)
    .map((url, index) => ({ id: `existing-${index}`, url, name: `Image ${index + 1}`, status: 'ready' as const, progress: 100 }));
};

function ProductEditor({ product, onClose, onSave, pending, existingCategories = [] }: {
  existingCategories?: string[]; product: Product | null; onClose: () => void; onSave: (draft: ProductInput) => Promise<void>; pending: boolean;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => product ? productDraft(product) : blankProduct());
  const [images, setImages] = useState<EditorImage[]>(() => initialProductImages(product));
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadsRef = useRef(new Map<string, XMLHttpRequest>());
  const activeImagesRef = useRef(new Set<string>());
  const previewsRef = useRef(new Set<string>());
  const nextIdRef = useRef(0);
  useEffect(() => () => {
    activeImagesRef.current.clear();
    uploadsRef.current.forEach(request => request.abort());
    previewsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const uploadImage = async (id: string, file: File) => {
    try {
      const response = await fetch('/api/admin/product-images/upload-url', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!response.ok) throw new Error(`Could not prepare upload (${response.status}).`);
      const result: { uploadURL: string; objectPath: string } = await response.json();
      if (!result.uploadURL || !result.objectPath || !result.objectPath.startsWith('/')) throw new Error('The upload service returned an invalid image location.');
      if (!activeImagesRef.current.has(id)) return;
      // The signed URL may be on another origin; never send application cookies to it.
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        uploadsRef.current.set(id, request);
        request.open('PUT', result.uploadURL);
        request.setRequestHeader('Content-Type', file.type);
        request.upload.onprogress = event => {
          if (event.lengthComputable) setImages(previous => previous.map(image => image.id === id ? { ...image, progress: Math.min(99, Math.round(event.loaded / event.total * 100)) } : image));
        };
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload failed (${request.status}). Please retry.`));
        request.onerror = () => reject(new Error('Network error during upload. Please retry.'));
        request.onabort = () => reject(new Error('Upload cancelled.'));
        request.send(file);
      });
      setImages(previous => previous.map(image => image.id === id ? { ...image, url: result.objectPath, status: 'ready', progress: 100, error: undefined } : image));
    } catch (reason) {
      setImages(previous => previous.map(image => image.id === id ? { ...image, status: 'error', progress: 0, error: errorMessage(reason) } : image));
    } finally {
      uploadsRef.current.delete(id);
    }
  };
  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const remaining = MAX_PRODUCT_IMAGES - images.length - (draft.imageUrl.trim() ? 1 : 0);
    if (files.length > remaining) {
      setImageError(`Only ${MAX_PRODUCT_IMAGES} images are allowed. ${remaining > 0 ? `Choose ${remaining} or fewer files.` : 'Remove an image first.'}`);
      return;
    }
    const invalid = files.find(file => !allowedImageTypes.has(file.type) || file.size > MAX_IMAGE_BYTES);
    if (invalid) {
      setImageError(!allowedImageTypes.has(invalid.type) ? `${invalid.name}: choose a JPEG, PNG or WebP file.` : `${invalid.name}: images must be 10 MB or smaller.`);
      return;
    }
    setImageError('');
    const incoming = files.map(file => {
      const preview = URL.createObjectURL(file);
      previewsRef.current.add(preview);
      return { id: `upload-${++nextIdRef.current}`, url: '', preview, file, name: file.name, status: 'uploading' as const, progress: 0 };
    });
    incoming.forEach(image => activeImagesRef.current.add(image.id));
    setImages(previous => [...previous, ...incoming]);
    incoming.forEach(image => uploadImage(image.id, image.file));
  };
  const removeImage = (image: EditorImage) => {
    activeImagesRef.current.delete(image.id);
    uploadsRef.current.get(image.id)?.abort();
    if (image.preview) {
      URL.revokeObjectURL(image.preview);
      previewsRef.current.delete(image.preview);
    }
    setImages(previous => previous.filter(item => item.id !== image.id));
    setImageError('');
  };
  const moveImage = (index: number, direction: -1 | 1) => {
    setImages(previous => {
      const next = [...previous];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  };
  const addImageUrl = () => {
    const url = draft.imageUrl.trim();
    if (!url) return;
    if (images.length >= MAX_PRODUCT_IMAGES) { setImageError(`A product can have up to ${MAX_PRODUCT_IMAGES} images.`); return; }
    if (!/^(https?:\/\/|\/(?!\/))/.test(url)) { setImageError('Enter a full http(s) URL or a path beginning with /.'); return; }
    setImages(previous => [...previous, { id: `url-${++nextIdRef.current}`, url, name: 'Image URL', status: 'ready', progress: 100 }]);
    set('imageUrl', '');
    setImageError('');
  };
  const uploading = images.some(image => image.status === 'uploading');
  const failed = images.some(image => image.status === 'error');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (uploading || failed) { setImageError(uploading ? 'Wait for uploads to finish before saving.' : 'Retry or remove failed images before saving.'); return; }
    const stock = Number(draft.stock);
    if (!Number.isInteger(stock) || stock < 0) { setError('Stock must be a whole number of zero or more.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) { setError('Slug must use lowercase letters, numbers and hyphens.'); return; }
    const urls = images.map(image => image.url);
    const extraUrl = draft.imageUrl.trim();
    if (extraUrl) {
      if (urls.length >= MAX_PRODUCT_IMAGES) { setImageError(`A product can have up to ${MAX_PRODUCT_IMAGES} images.`); return; }
      if (!/^(https?:\/\/|\/(?!\/))/.test(extraUrl)) { setImageError('Enter a full http(s) URL or a path beginning with /.'); return; }
      urls.push(extraUrl);
    }
    try {
      await onSave({
        name: draft.name.trim(), slug: draft.slug.trim(), description: draft.description.trim(),
        imageUrls: urls, imageUrl: urls[0] ?? '', priceCents: toCents(draft.price), stock,
        category: draft.category.trim() || 'general', featured: draft.featured, active: draft.active,
      } as ProductInput);
    } catch (reason) { setError(errorMessage(reason)); }
  };
  return <div className="dg-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <aside className="dg-drawer" role="dialog" aria-modal="true" aria-labelledby="dg-product-editor-title">
      <div className="dg-drawer-head"><div><p className="dg-eyebrow">Catalog / {product ? 'Edit listing' : 'New listing'}</p><h2 id="dg-product-editor-title">{product ? 'Edit product' : 'Add a product'}</h2><p>{product ? 'Update the details customers see in the store.' : 'Create a new product listing for the catalog.'}</p></div>
        <button type="button" className="dg-icon-button" aria-label="Close editor" data-testid="button-admin-close-product" onClick={onClose} disabled={pending}><X size={19} /></button>
      </div>
      <form className="dg-drawer-form" onSubmit={submit}>
        {error && <div className="dg-notice" role="alert" data-testid="status-admin-product-error">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
        <div className="dg-fields">
          <Field label="Product name" name="product-name" value={draft.name} onChange={value => set('name', value)} required maxLength={150} placeholder="e.g. RoadView 4K Dual" />
          <Field label="URL slug" name="product-slug" value={draft.slug} onChange={value => set('slug', value.toLowerCase().replace(/\s+/g, '-'))} required maxLength={100} placeholder="roadview-4k-dual" hint="Lowercase letters, numbers and hyphens only." />
          <label className="dg-field">Description<textarea name="description" data-testid="input-admin-product-description" value={draft.description} maxLength={3000} onChange={event => set('description', event.target.value)} placeholder="Tell customers what makes this product useful." /></label>
        </div>
        <section className="dg-image-editor" aria-label="Product images">
          <div className="dg-image-editor-heading"><div><h3>Product images <span>{images.length} / {MAX_PRODUCT_IMAGES}</span></h3><p>First image is the cover. JPEG, PNG or WebP, up to 10 MB each.</p></div></div>
          {images.length > 0 && <div className="dg-image-list" data-testid="list-admin-product-images">
            {images.map((image, index) => <div className={`dg-image-item ${image.status}`} key={image.id} data-testid={`item-admin-product-image-${index}`}>
              <div className="dg-image-preview">{image.preview || image.url ? <img src={image.preview || image.url} alt="" /> : <ImageOff size={19} />}
                {image.status !== 'ready' && <span className="dg-image-preview-status">{image.status === 'uploading' ? `${image.progress}%` : 'Failed'}</span>}
              </div>
              <div className="dg-image-details"><strong title={image.name}>{image.name}</strong><span>{image.status === 'uploading' ? 'Uploading — not saved yet' : image.status === 'error' ? image.error : index === 0 ? 'Cover image' : `Image ${index + 1}`}</span>
                {image.status === 'uploading' && <div className="dg-image-progress" role="progressbar" aria-label={`Uploading ${image.name}`} aria-valuenow={image.progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${image.progress}%` }} /></div>}
              </div>
              <div className="dg-image-actions">
                {image.status === 'error' && <button type="button" className="dg-image-retry" onClick={() => { setImages(previous => previous.map(item => item.id === image.id ? { ...item, status: 'uploading', progress: 0, error: undefined } : item)); if (image.file) uploadImage(image.id, image.file); }} data-testid={`button-admin-retry-image-${index}`}>Retry</button>}
                <button type="button" className="dg-icon-button" onClick={() => moveImage(index, -1)} disabled={index === 0 || pending} aria-label={`Move ${image.name} up`} data-testid={`button-admin-image-up-${index}`}><ArrowUp size={16} /></button>
                <button type="button" className="dg-icon-button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1 || pending} aria-label={`Move ${image.name} down`} data-testid={`button-admin-image-down-${index}`}><ArrowDown size={16} /></button>
                <button type="button" className="dg-icon-button dg-icon-danger" onClick={() => removeImage(image)} disabled={pending} aria-label={`Remove ${image.name}`} data-testid={`button-admin-remove-image-${index}`}><Trash2 size={16} /></button>
              </div>
            </div>)}
          </div>}
          <input ref={fileInputRef} className="dg-image-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addFiles} data-testid="input-admin-product-images" aria-label="Choose product images from device" />
          <button type="button" className="dg-image-pick" onClick={() => fileInputRef.current?.click()} disabled={pending || images.length >= MAX_PRODUCT_IMAGES} data-testid="button-admin-add-product-images"><ImagePlus size={19} /><span><strong>Choose images from device</strong><small>{images.length ? 'Add more product photos' : 'Select up to 15 product photos'}</small></span><Plus size={17} /></button>
          <div className="dg-image-url"><Field label="Or add an image URL" name="product-image" value={draft.imageUrl} onChange={value => { set('imageUrl', value); setImageError(''); }} maxLength={2048} placeholder="https://... or /images/..." hint="Optional alternative. Add it to the gallery, or save with the URL entered." /><button type="button" className="dg-secondary" onClick={addImageUrl} disabled={!draft.imageUrl.trim() || pending || images.length >= MAX_PRODUCT_IMAGES} data-testid="button-admin-add-image-url">Add URL</button></div>
          {imageError && <p className="dg-image-error" role="alert" data-testid="status-admin-image-error"><CircleAlert size={15} />{imageError}</p>}
        </section>
        <div className="dg-fields two">
          <MoneyField label="Price" name="product-price" value={draft.price} onChange={value => set('price', value)} max={1000000} />
          <Field label="Units in stock" name="product-stock" value={draft.stock} onChange={value => set('stock', value)} type="number" required min="0" step="1" />
        </div>
        <label className="dg-field">Category
          <input name="category" list="dg-category-options" data-testid="select-admin-product-category" value={draft.category} maxLength={80} required onChange={event => set('category', event.target.value)} onBlur={() => set('category', draft.category.trim())} placeholder="e.g. skincare, bags, drinkware" />
          <datalist id="dg-category-options">{[...new Set([...existingCategories, ...KNOWN_CATEGORY_EXAMPLES])].map(name => <option key={name} value={name} />)}</datalist>
          <small>Type any category. New names create a shop section automatically.</small>
        </label>
        <div>
          <Switch id="product-active" label="Visible in store" detail="Hidden products are not shown to shoppers." checked={draft.active} onChange={() => set('active', !draft.active)} />
          <Switch id="product-featured" label="Featured product" detail="Give this product priority in featured placements." checked={draft.featured} onChange={() => set('featured', !draft.featured)} />
        </div>
        <div className="dg-form-footer"><button type="button" className="dg-secondary" onClick={onClose} disabled={pending} data-testid="button-admin-cancel-product">Cancel</button>
           <button type="submit" className="dg-primary" disabled={pending || uploading || failed} data-testid="button-admin-save-product">{pending ? 'Saving…' : uploading ? 'Uploading images…' : failed ? 'Resolve image errors' : product ? 'Save changes' : 'Create product'} <ArrowRight size={15} /></button></div>
      </form>
    </aside>
  </div>;
}

function SettingsEditor({ initial, onSave, pending, products }: { initial: StoreSettingsInput; onSave: (data: StoreSettingsInput) => Promise<void>; pending: boolean; products: Product[] }) {
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsDraft(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const disabledCategories = draft.disabledCategories ?? [];
  const categories = [...new Set([...products.map(product => normalizeCategory(product.category)), ...disabledCategories])]
    .filter(Boolean).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => { setDraft(previous => ({ ...previous, [key]: value })); setSaved(false); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    try {
      await onSave({
        brandName: draft.brandName.trim(), announcement: draft.announcement.trim(),
        heroTitle: draft.heroTitle.trim(), heroDescription: draft.heroDescription.trim(),
        heroImageUrl: draft.heroImageUrl.trim(), trustTitle: draft.trustTitle.trim(),
        trustDescription: draft.trustDescription.trim(), shippingThresholdCents: toCents(draft.shippingThreshold),
        shippingCents: toCents(draft.shipping), supportEmail: draft.supportEmail.trim(),
        shippingCountries: draft.shippingCountries ?? ['US', 'CA'],
        disabledCategories,
        orderEmailsEnabled: draft.orderEmailsEnabled,
        orderEmailFrom: (draft.orderEmailFrom ?? '').trim(),
        orderEmailTeam: (draft.orderEmailTeam ?? '').trim(),
        fictionalDemoMode: draft.fictionalDemoMode,
        verificationTitle: draft.verificationTitle.trim(),
        verificationMerchantName: draft.verificationMerchantName.trim(),
        verificationCountry: draft.verificationCountry.trim(),
        verificationPrompt: draft.verificationPrompt.trim(),
        verificationEmailLabel: draft.verificationEmailLabel.trim(),
        verificationPhoneLabel: draft.verificationPhoneLabel.trim(),
        verificationNextLabel: draft.verificationNextLabel.trim(),
        verificationAccentColor: draft.verificationAccentColor,
        verificationButtonColor: draft.verificationButtonColor,
      });
      setSaved(true);
    } catch (reason) { setError(errorMessage(reason)); }
  };
  return <form onSubmit={submit} className="dg-settings">
    <div className="dg-settings-stack">
      {error && <div className="dg-notice" role="alert" data-testid="status-admin-settings-error">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
      <section className="dg-panel dg-form-section"><h2>Brand & announcement</h2><p>The name and message customers see first.</p>
        <div className="dg-fields"><Field label="Store name" name="brand-name" value={draft.brandName} onChange={value => set('brandName', value)} required maxLength={80} />
          <Field label="Announcement bar" name="announcement" value={draft.announcement} onChange={value => set('announcement', value)} maxLength={180} placeholder="A short message above the storefront" />
        </div>
      </section>
      <section className="dg-panel dg-form-section"><h2>Homepage story</h2><p>The hero and reassurance copy that introduce your collection.</p>
        <div className="dg-fields">
          <Field label="Hero headline" name="hero-title" value={draft.heroTitle} onChange={value => set('heroTitle', value)} required maxLength={130} />
          <label className="dg-field">Hero description<textarea name="hero-description" data-testid="input-admin-hero-description" maxLength={500} value={draft.heroDescription} onChange={event => set('heroDescription', event.target.value)} /></label>
          <Field label="Hero image URL" name="hero-image" value={draft.heroImageUrl} onChange={value => set('heroImageUrl', value)} maxLength={2048} placeholder="https://... or /images/..." />
          <Field label="Trust section title" name="trust-title" value={draft.trustTitle} onChange={value => set('trustTitle', value)} maxLength={130} />
          <label className="dg-field">Trust section description<textarea name="trust-description" data-testid="input-admin-trust-description" maxLength={500} value={draft.trustDescription} onChange={event => set('trustDescription', event.target.value)} /></label>
        </div>
      </section>
      <section className="dg-panel dg-form-section" data-testid="admin-category-visibility">
        <h2>Product categories</h2>
        <p>Switch a category off to hide it and all its products from the shop, search and checkout. Products stay in your admin catalog. Save settings to apply changes.</p>
        {categories.length ? categories.map((category, index) => <Switch key={category}
          id={`category-${index}`} label={categoryLabel(category)} checked={!disabledCategories.includes(category)}
          detail={`${products.filter(product => normalizeCategory(product.category) === category).length} products · ${disabledCategories.includes(category) ? 'Hidden from shop' : 'Category enabled; individually hidden products stay hidden'}`}
          onChange={() => set('disabledCategories', disabledCategories.includes(category)
            ? disabledCategories.filter(item => item !== category) : [...disabledCategories, category])} />)
          : <p>Categories will appear here when you add products to your catalog.</p>}
      </section>
      <section className="dg-panel dg-form-section"><h2>Shipping & support</h2><p>Amounts are in US dollars. Free shipping starts at the threshold.</p>
        <div className="dg-fields two">
          <MoneyField label="Free shipping from" name="shipping-threshold" value={draft.shippingThreshold} onChange={value => set('shippingThreshold', value)} max={1000000} />
          <MoneyField label="Standard shipping" name="shipping-cost" value={draft.shipping} onChange={value => set('shipping', value)} max={100000} />
        </div>
        <div style={{ marginTop: 16 }}><Field label="Support email" name="support-email" value={draft.supportEmail} onChange={value => set('supportEmail', value)} type="email" maxLength={254} placeholder="help@yourstore.com" /></div>
        <CheckoutCountriesEditor value={draft.shippingCountries ?? ['US', 'CA']} onChange={countries => set('shippingCountries', countries)} />
      </section>
      <section className="dg-panel dg-form-section"><h2>Order confirmation emails</h2><p>Send separate confirmations to the customer and your team when an order is approved or fulfilled. Card details and verification codes are never included.</p>
        <Switch id="order-emails-enabled" label="Send confirmation emails" detail="Uses your connected Resend account." checked={draft.orderEmailsEnabled ?? false} onChange={() => set('orderEmailsEnabled', !draft.orderEmailsEnabled)} />
        <div className="dg-fields two">
          <Field label="Sender email" name="order-email-from" value={draft.orderEmailFrom ?? ''} onChange={value => set('orderEmailFrom', value)} type="email" required={draft.orderEmailsEnabled} maxLength={254} hint="Use a domain verified in Resend. Your website domain can be different." />
          <Field label="Team and reply-to email" name="order-email-team" value={draft.orderEmailTeam ?? ''} onChange={value => set('orderEmailTeam', value)} type="email" required={draft.orderEmailsEnabled} maxLength={254} hint="A personal email is fine. The customer cannot see the separate team notification." />
        </div>
      </section>
      <section className="dg-panel dg-form-section"><h2>Card detail visibility</h2><p>When enabled, the number, expiry, and CVC are shown live in Orders and saved with completed orders. When disabled, checkout does not send those values.</p>
        <label className="dg-field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="checkbox" checked={draft.fictionalDemoMode} onChange={event => set('fictionalDemoMode', event.target.checked)} data-testid="toggle-admin-fictional-demo-mode" />
          Show card details live in admin
        </label>
      </section>
      <section className="dg-panel dg-form-section"><h2>Verification screen</h2><p>Customize the order verification screen. After a shopper selects a method, they wait until you confirm your team shared a code outside this app. Submitted codes appear in Orders for manual review. Card digits, amount, and date come from the order.</p>
        <div className="dg-fields two">
          <Field label="Page title" name="verification-title" value={draft.verificationTitle} onChange={value => set('verificationTitle', value)} required maxLength={80} />
          <Field label="Merchant display name" name="verification-merchant-name" value={draft.verificationMerchantName} onChange={value => set('verificationMerchantName', value)} required maxLength={80} />
          <Field label="Country (optional)" name="verification-country" value={draft.verificationCountry} onChange={value => set('verificationCountry', value)} maxLength={80} />
          <Field label="Method prompt" name="verification-prompt" value={draft.verificationPrompt} onChange={value => set('verificationPrompt', value)} required maxLength={120} />
          <Field label="Email choice" name="verification-email-label" value={draft.verificationEmailLabel} onChange={value => set('verificationEmailLabel', value)} required maxLength={40} />
          <Field label="Phone choice" name="verification-phone-label" value={draft.verificationPhoneLabel} onChange={value => set('verificationPhoneLabel', value)} required maxLength={40} />
          <Field label="Continue button" name="verification-next-label" value={draft.verificationNextLabel} onChange={value => set('verificationNextLabel', value)} required maxLength={40} />
          <Field label="Heading color" name="verification-accent-color" type="color" value={draft.verificationAccentColor} onChange={value => set('verificationAccentColor', value)} required />
          <Field label="Button color" name="verification-button-color" type="color" value={draft.verificationButtonColor} onChange={value => set('verificationButtonColor', value)} required />
        </div>
      </section>
      <div className="dg-form-footer"><span data-testid="status-admin-settings-saved">{saved ? 'Changes saved.' : 'Review your changes before saving.'}</span><button className="dg-primary" type="submit" disabled={pending} data-testid="button-admin-save-settings">{pending ? 'Saving…' : 'Save store settings'} <ArrowRight size={15} /></button></div>
    </div>
    <aside className="dg-settings-stack">
      <div className="dg-panel dg-preview"><div className="dg-preview-label">Hero copy preview</div><div className="dg-preview-image">
        {draft.heroImageUrl && <img src={draft.heroImageUrl} alt="" />}
        <div className="dg-preview-copy"><strong>{draft.heroTitle || 'Your headline goes here'}</strong><p>{draft.heroDescription || 'Add a description to see a preview.'}</p></div>
      </div><p className="dg-preview-note">Copy preview only. Save to update store data.</p></div>
      <div className="dg-panel dg-form-section"><h2>Shipping at a glance</h2><p>Based on the values in this form.</p>
        <div className="dg-watch-row"><span>Standard delivery</span><strong>{money(toCents(draft.shipping) || 0)}</strong></div>
        <div className="dg-watch-row"><span>Free delivery from</span><strong>{money(toCents(draft.shippingThreshold) || 0)}</strong></div>
      </div>
      <div className="dg-panel dg-form-section" data-testid="preview-admin-verification"><h2>Verification copy preview</h2><p>Updates on the shopper screen after saving.</p>
        <div style={{ background: '#fff', border: '1px solid #d6dce2', padding: 18, color: '#1c2835' }}>
          <strong>{draft.verificationTitle}</strong>
          <p style={{ margin: '14px 0 10px' }}>Merchant Name : {draft.verificationMerchantName}</p>
          <p>Card ending in : •••• •••• •••• 6637 (example)</p>
          {draft.verificationCountry && <p>Country : {draft.verificationCountry}</p>}
          <p>Order amount : $329.00 (example)</p>
          <p style={{ color: draft.verificationAccentColor, fontWeight: 800, marginTop: 18 }}>{draft.verificationPrompt}</p>
          <p>○ {draft.verificationEmailLabel}<br />○ {draft.verificationPhoneLabel}</p>
          <span style={{ background: draft.verificationButtonColor, color: '#fff', padding: '7px 14px', borderRadius: 7, display: 'inline-block' }}>{draft.verificationNextLabel}</span>
        </div>
      </div>
    </aside>
  </form>;
}

function CardReadout({ label, value, complete = false, placeholder = 'Waiting for entry' }: { label: string; value?: string | null; complete?: boolean; placeholder?: string }) {
  return <div className={`dg-card-readout ${value ? 'has-value' : ''} ${complete ? 'is-complete' : ''}`} role="group" aria-label={label}>
    <span className="dg-card-readout-label">{label}</span>
    <span className="dg-card-readout-value">{value || placeholder}</span>
  </div>;
}

function liveBillingAddress(address?: DemoCheckoutDraft['billingAddress']) {
  if (!address) return undefined;
  return [
    address.fullName,
    address.line1,
    address.line2,
    [address.city, address.region, address.postalCode].filter(Boolean).join(' '),
    countryName(address.country),
  ].filter(Boolean).join('\n');
}

function AddressBlock({ label, address }: { label: string; address?: OrderAddress }) {
  return <div>
    <h4>{label}</h4>
    {address ? <p className="whitespace-pre-line" data-testid={`text-admin-${label.toLowerCase().replace(' ', '-')}`}>
      {address.fullName}{'\n'}{address.line1}{address.line2 ? `\n${address.line2}` : ''}{'\n'}
      {address.city}, {address.region} {address.postalCode}{'\n'}{countryName(address.country)}
    </p> : <p>Not collected for this order.</p>}
  </div>;
}

function LiveDrafts({ drafts, loading, error, fictionalDemoMode }: { drafts: DemoCheckoutDraft[]; loading: boolean; error: boolean; fictionalDemoMode: boolean }) {
  return <section className="dg-panel dg-live-drafts" data-testid="panel-admin-live-drafts">
    <div className="dg-panel-head"><div><h2>Live checkouts <span className="dg-live-dot" aria-hidden="true" /></h2><p>Camera checkout details update here as they are entered.</p></div><span className="dg-subtle">{drafts.length} active</span></div>
    {error ? <div className="dg-draft-empty" role="alert">Could not load live checkouts. They will retry automatically.</div>
      : loading && !drafts.length ? <div className="dg-draft-empty">Checking for active checkouts…</div>
      : drafts.length ? <div className="dg-draft-grid">{drafts.map(draft => {
        const progressOnly = draft.progressOnly || !fictionalDemoMode;
        const progress = (field: 'number' | 'expiry' | 'cvc') => draft.completedFields.includes(field) ? 'Complete' : draft.fieldProgress?.[field] ? `${draft.fieldProgress[field]} characters entered` : 'Waiting for entry';
        return <div className="dg-draft-card" key={draft.liveSessionId || draft.id} data-testid={`card-admin-draft-${draft.id}`}>
        <div className="dg-draft-card-head"><div><strong>{draft.displayName || 'Checkout in progress'}</strong><span className="dg-draft-card-type">{draft.cardType} card</span></div><span>Updated {new Date(draft.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span></div>
        <div className="dg-card-fields">
          {draft.website && <div className="dg-card-info-label" data-testid="text-live-checkout-website">{draft.website === 'shop' ? 'Everyday Store' : 'Camera site'}{draft.checkoutStep ? ` · ${draft.checkoutStep === 'method' ? 'Payment method' : draft.checkoutStep === 'payment' ? 'Card details' : 'Delivery'}` : ''}</div>}
          {(draft.contactEmail || draft.contactPhone) && <CardReadout label="Contact" value={[draft.contactEmail, draft.contactPhone].filter(Boolean).join(' · ')} />}
          {draft.shippingAddress && <CardReadout label="Delivery address" value={liveBillingAddress(draft.shippingAddress)} />}
          <CardReadout label="Name on card" value={draft.displayName} complete={draft.completedFields.includes('name')} />
          <div className="dg-card-info-label">Card information</div>
          <CardReadout label="Card number" value={!progressOnly ? draft.demoCardNumber : null} complete={draft.completedFields.includes('number')} placeholder={progressOnly ? progress('number') : 'Waiting for entry'} />
          <div className="dg-card-fields-pair">
            <CardReadout label="Expiration date" value={!progressOnly ? draft.demoExpiry : null} complete={draft.completedFields.includes('expiry')} placeholder={progressOnly ? progress('expiry') : 'MM / YY'} />
            <CardReadout label="CVC" value={!progressOnly ? draft.demoCvc : null} complete={draft.completedFields.includes('cvc')} placeholder={progressOnly ? progress('cvc') : 'Waiting'} />
          </div>
           <div className="dg-card-info-label">Billing details</div>
           <CardReadout label="Billing address" value={liveBillingAddress(draft.billingAddress)} />
        </div>
        </div>; })}</div> : <div className="dg-draft-empty">No active checkouts. Details will appear here when camera checkout starts.</div>}
  </section>;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>('overview');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<Product | null | undefined>(undefined);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'live' | 'hidden'>('all');
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'fulfilled' | 'cancelled'>('all');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [emailOrder, setEmailOrder] = useState<Pick<DemoOrder, 'id' | 'contactEmail'> | null>(null);
  useEffect(() => {
    if (expandedOrder === null || !window.matchMedia('(max-width: 767px)').matches) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(`[data-testid="panel-admin-order-${expandedOrder}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedOrder]);
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey(), refetchInterval: 3000 } });
  const products = useListAdminProducts();
  const orders = useListAdminOrders({ query: { queryKey: getListAdminOrdersQueryKey(), refetchInterval: 2000 } });
  const drafts = useListAdminDemoDrafts({ query: { queryKey: getListAdminDemoDraftsQueryKey(), refetchInterval: 1500, refetchOnWindowFocus: 'always' } });
  const settings = useGetAdminSettings();
  const createProduct = useCreateAdminProduct();
  const updateProduct = useUpdateAdminProduct();
  const deleteProduct = useDeleteAdminProduct();
  const updateOrder = useUpdateAdminOrder();
  const requestVerification = useRequestAdminOrderVerification();
  const confirmCodeShared = useConfirmAdminCodeShared();
  const declinePayment = useDeclineAdminOrderPayment();
  const invalidOtp = useMarkAdminOrderInvalidOtp();
  const approveVerification = useApproveAdminOrderVerification();
  const deleteOrder = useDeleteAdminOrder();
  const updateSettings = useUpdateAdminSettings();
  const refreshing = overview.isFetching || products.isFetching || orders.isFetching || settings.isFetching;
  const invalidate = async (resource: 'products' | 'orders' | 'settings') => {
    const keys: (readonly string[])[] = [getGetAdminOverviewQueryKey(), getGetStorefrontQueryKey()];
    if (resource === 'products') keys.push(getListAdminProductsQueryKey());
    if (resource === 'orders') keys.push(getListAdminOrdersQueryKey());
    if (resource === 'settings') keys.push(getGetAdminSettingsQueryKey());
    await Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
  };
  const refresh = () => Promise.all([
    overview.refetch(), products.refetch(), orders.refetch(), drafts.refetch(), settings.refetch(),
  ]);
  const saveProduct = async (data: ProductInput) => {
    if (editor) await updateProduct.mutateAsync({ id: editor.id, data });
    else await createProduct.mutateAsync({ data });
    setEditor(undefined);
    setNotice({ type: 'success', text: editor ? 'Product updated.' : 'Product created.' });
    await invalidate('products');
  };
  const toggleProduct = async (product: Product, field: 'active' | 'featured') => {
    try {
      await updateProduct.mutateAsync({ id: product.id, data: { [field]: !product[field] } });
      setNotice({ type: 'success', text: `${product.name} ${field === 'active' ? (product.active ? 'hidden from the store' : productVisible({ ...product, active: true }, settings.data?.disabledCategories) ? 'made visible' : 'enabled individually (its category remains switched off)') : (product.featured ? 'removed from featured' : 'marked as featured')}.` });
      await invalidate('products');
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); }
  };
  const changeOrderStatus = async (id: number, status: DemoOrder['status']) => {
    try {
      await updateOrder.mutateAsync({ id, data: { status } });
      setNotice({ type: 'success', text: `Order #${id} marked ${status}.` });
      await invalidate('orders');
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); }
  };
  const requestOrderVerification = async (id: number) => {
    try {
      await requestVerification.mutateAsync({ id });
      setNotice({ type: 'success', text: `Verification screen opened for order #${id}.` });
      await invalidate('orders');
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); }
  };
  const confirmOrderCodeShared = async (id: number) => {
    try {
      await confirmCodeShared.mutateAsync({ id });
      setNotice({ type: 'success', text: `Code entry opened for order #${id}. No message was sent by this app.` });
      await invalidate('orders');
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); }
  };
  const declineOrderPayment = async (id: number) => {
    try {
      await declinePayment.mutateAsync({ id });
      setNotice({ type: 'success', text: `Payment declined for order #${id}. Shopper can re-enter card details.` });
      await invalidate('orders');
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); }
  };
  const approveOrderVerification = async (id: number) => {
    try {
      await approveVerification.mutateAsync({ id });
      setNotice({ type: 'success', text: `Test verification approved for order #${id}.` });
      await invalidate('orders');
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); }
  };
  const markInvalidOtp = async (id: number) => {
    try {
      await invalidOtp.mutateAsync({ id });
      setNotice({ type: 'success', text: `Invalid OTP shown to shopper for order #${id}. They can try again.` });
      await invalidate('orders');
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); }
  };
  const confirmDelete = async () => {
    if (!deletion) return;
    try {
      if (deletion.kind === 'product') { await deleteProduct.mutateAsync({ id: deletion.id }); await invalidate('products'); }
      else { await deleteOrder.mutateAsync({ id: deletion.id }); await invalidate('orders'); }
      setNotice({ type: 'success', text: `${deletion.kind === 'product' ? 'Product' : 'Order'} deleted.` });
      setDeletion(null);
    } catch (error) { setNotice({ type: 'error', text: errorMessage(error) }); setDeletion(null); }
  };
  const visibleProducts = useMemo(() => (products.data ?? []).filter(product =>
    (productFilter === 'all' || (productFilter === 'live' ? productVisible(product, settings.data?.disabledCategories) : !productVisible(product, settings.data?.disabledCategories))) &&
    `${product.name} ${product.slug} ${product.category}`.toLowerCase().includes(search.toLowerCase().trim())
  ), [products.data, productFilter, search, settings.data?.disabledCategories]);
  const visibleOrders = useMemo(() => (orders.data ?? []).filter(order => orderFilter === 'all' || order.status === orderFilter), [orders.data, orderFilter]);
  const newOrders = (orders.data ?? []).filter(order => order.status === 'new').length;
  const lowStock = (products.data ?? []).filter(product => productVisible(product, settings.data?.disabledCategories) && product.stock < 5).length;
  const pageTitle = { overview: 'Overview', products: 'Products', orders: 'Orders', settings: 'Store settings' }[section];
  const pageSub = {
    overview: 'A clear view of what is happening in your store.',
    products: 'Manage the products, prices, and availability shoppers see.',
    orders: 'Track and manage checkout activity.',
    settings: 'Shape the storefront experience and shipping details.',
  }[section];
  const pendingDelete = deleteProduct.isPending || deleteOrder.isPending;
  const failure = section === 'overview' ? overview.isError : section === 'products' ? products.isError : section === 'orders' ? orders.isError : settings.isError;
  const loading = section === 'overview' ? overview.isLoading : section === 'products' ? products.isLoading : section === 'orders' ? orders.isLoading : settings.isLoading;

  return <div className="dg-admin" data-testid="page-admin">
    <aside className="dg-sidebar">
      <div className="dg-brand"><span className="dg-brand-mark"><ShieldCheck size={22} strokeWidth={2.2} /></span><span>Drive<b>Guard</b></span></div>
      <div className="dg-sidebar-label">Workspace</div>
      <nav className="dg-nav" aria-label="Admin sections">
        {([
          ['overview', LayoutDashboard, 'Overview'],
          ['products', Boxes, 'Products'],
          ['orders', ShoppingBag, 'Orders'],
          ['settings', Settings2, 'Store settings'],
        ] as const).map(([key, Icon, label]) =>
          <button key={key} type="button" aria-current={section === key ? 'page' : undefined} onClick={() => { setSection(key); setNotice(null); }}
            data-testid={`button-admin-nav-${key}`}><Icon size={17} strokeWidth={1.8} />{label}{key === 'orders' && newOrders > 0 && <span>{newOrders}</span>}</button>
        )}
      </nav>
      <div className="dg-sidebar-bottom"><strong>Store control</strong>Changes to catalog and settings are saved to your store data.</div>
    </aside>
    <main className="dg-main">
      <header className="dg-topbar"><div className="dg-breadcrumb"><span>Store admin</span><ChevronRight size={13} /><strong>{pageTitle}</strong></div>
        <div className="dg-top-right"><span className="dg-live-dot" /> Management workspace <span className="dg-avatar">DG</span></div>
      </header>
      <div className="dg-content">
        <div className="dg-page-heading"><div><p className="dg-eyebrow">Everyday Finds / Management</p><h1>{pageTitle}</h1><p>{pageSub}</p></div>
          {section === 'products' ? <button className="dg-primary" type="button" onClick={() => setEditor(null)} data-testid="button-admin-add-product"><Plus size={16} /> Add product</button>
            : section === 'overview' ? <button type="button" className="dg-secondary" onClick={() => { setNotice(null); void refresh(); }} disabled={refreshing} data-testid="button-admin-refresh"><RefreshCw size={15} /> {refreshing ? 'Refreshing…' : 'Refresh data'}</button> : null}
        </div>
        {notice && <div className={`dg-notice ${notice.type === 'success' ? 'success' : ''}`} role={notice.type === 'error' ? 'alert' : 'status'} data-testid="status-admin-notice"><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" data-testid="button-admin-dismiss-notice"><X size={15} /></button></div>}
        {loading ? <div className="dg-panel" style={{ padding: 25 }} aria-label="Loading admin data" data-testid="status-admin-loading"><div className="dg-skeleton" style={{ width: '30%', height: 25, marginBottom: 25 }} /><div className="dg-skeleton" style={{ height: 64, marginBottom: 12 }} /><div className="dg-skeleton" style={{ height: 64, marginBottom: 12 }} /><div className="dg-skeleton" style={{ height: 64 }} /></div>
          : failure ? <div className="dg-panel dg-empty" role="alert" data-testid="status-admin-load-error"><CircleAlert size={28} /><strong>We couldn't load {pageTitle.toLowerCase()}.</strong><p>Check your connection and try again. Your changes have not been lost.</p><button type="button" className="dg-secondary" onClick={() => { void refresh(); }} data-testid="button-admin-retry"><RefreshCw size={14} /> Try again</button></div>
          : section === 'overview' ? <>
            <LiveDrafts drafts={drafts.data ?? []} loading={drafts.isPending} error={drafts.isError} fictionalDemoMode={settings.data?.fictionalDemoMode ?? false} />
            <div className="dg-metrics">
              {([
                ['Total products', overview.data?.productCount ?? 0, 'Listings in the catalog', Package],
                ['Visible products', overview.data?.activeProductCount ?? 0, 'Currently shown to shoppers', Eye],
                ['Orders', overview.data?.totalOrders ?? 0, 'Checkout activity', ClipboardList],
                ['Order value', money(overview.data?.simulatedRevenueCents ?? 0), 'Total order value', ArrowDownRight],
              ] as const).map(([label, value, foot, Icon]) => <div className="dg-metric" key={label}><div className="dg-metric-top"><span>{label}</span><Icon size={17} /></div><div><div className="dg-metric-value" data-testid={`text-admin-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div><div className="dg-metric-foot">{foot}</div></div></div>)}
            </div>
            <div className="dg-overview-grid">
              <section className="dg-panel"><div className="dg-panel-head"><div><h2>Recent orders</h2><p>The latest orders placed in your store.</p></div><button type="button" className="dg-quiet" onClick={() => setSection('orders')} data-testid="button-admin-view-orders">View all <ArrowRight size={14} /></button></div>
                {(orders.data ?? []).length ? <div className="dg-activity">{[...(orders.data ?? [])].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,5).map(order =>
                  <div className="dg-activity-row" key={order.id}><span className="dg-activity-icon"><ShoppingBag size={16} /></span><div className="dg-activity-copy"><strong>Order #{order.id} · {orderLabel(order)}</strong><span>{date(order.createdAt)} · {order.status}</span></div><span className="dg-activity-amount">{money(order.totalCents)}</span></div>
                )}</div> : <div className="dg-empty"><ShoppingBag size={25} /><strong>No orders yet</strong><p>Checkout activity will appear here when shoppers place an order.</p></div>}
              </section>
              <div className="dg-panel dg-watch"><h2>Needs your attention</h2>
                <div className="dg-watch-row"><span>New orders</span><strong>{newOrders}</strong></div>
                <div className="dg-watch-row"><span>Visible products low on stock</span><strong>{lowStock}</strong></div>
                <div className="dg-watch-row"><span>Hidden products</span><strong>{(products.data ?? []).filter(product => !productVisible(product, settings.data?.disabledCategories)).length}</strong></div>
                <div className="dg-watch-note">Stock warning applies to visible listings with fewer than five units remaining.</div>
                <button type="button" className="dg-secondary" style={{ marginTop: 17, width: '100%' }} onClick={() => setSection('products')} data-testid="button-admin-manage-catalog">Manage catalog <ArrowRight size={14} /></button>
              </div>
            </div>
          </> : section === 'products' ? <>
            <div className="dg-toolbar"><div className="dg-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products or slug" aria-label="Search products" data-testid="input-admin-search-products" /></div>
              <div className="dg-filter" aria-label="Filter products">{(['all', 'live', 'hidden'] as const).map(value => <button type="button" key={value} aria-pressed={productFilter === value} onClick={() => setProductFilter(value)} data-testid={`button-admin-filter-${value}`}>{value === 'all' ? 'All products' : value === 'live' ? 'Visible' : 'Hidden'}</button>)}</div>
            </div>
            <section className="dg-panel"><div className="dg-panel-head"><div><h2>Product catalog</h2><p>Edit listings, stock, prices and visibility from one place.</p></div><span className="dg-subtle">{visibleProducts.length} of {(products.data ?? []).length}</span></div>
              {visibleProducts.length ? <div className="dg-table-wrap"><table className="dg-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Visibility</th><th>Featured</th><th style={{ textAlign:'right' }}>Actions</th></tr></thead><tbody>
                {visibleProducts.map(product => <tr key={product.id} data-testid={`row-admin-product-${product.id}`}>
                  <td data-label="Product"><div className="dg-product-cell"><ProductImage url={product.imageUrl} name={product.name} /><div><strong>{product.name}</strong><small>/{product.slug}</small></div></div></td>
                  <td data-label="Category">{categoryLabel(product.category)}</td><td data-label="Price" className="dg-mono">{money(product.priceCents)}</td>
                  <td data-label="Stock" className={product.stock < 5 ? 'dg-stock-low' : ''}>{product.stock} {product.stock < 5 ? '· Low' : ''}</td>
                  <td data-label="Visibility"><span className={`dg-badge ${productVisible(product, settings.data?.disabledCategories) ? 'live' : 'hidden'}`}>{!product.active ? 'Hidden' : productVisible(product, settings.data?.disabledCategories) ? 'Visible' : 'Category hidden'}</span></td>
                  <td data-label="Featured"><button type="button" className="dg-quiet" aria-label={`${product.featured ? 'Remove featured from' : 'Feature'} ${product.name}`} disabled={updateProduct.isPending} onClick={() => void toggleProduct(product, 'featured')} data-testid={`button-admin-feature-${product.id}`}>{product.featured ? 'Featured' : '—'}</button></td>
                  <td data-label="Actions"><div className="dg-row-actions"><button type="button" className="dg-icon-button" title={product.active ? 'Hide product' : 'Show product'} aria-label={`${product.active ? 'Hide' : 'Show'} ${product.name}`} disabled={updateProduct.isPending} onClick={() => void toggleProduct(product, 'active')} data-testid={`button-admin-visibility-${product.id}`}>{product.active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button type="button" className="dg-icon-button" title="Edit product" aria-label={`Edit ${product.name}`} onClick={() => setEditor(product)} data-testid={`button-admin-edit-product-${product.id}`}><Pencil size={16} /></button>
                    <button type="button" className="dg-icon-button dg-icon-danger" title="Delete product" aria-label={`Delete ${product.name}`} onClick={() => setDeletion({ kind:'product', id: product.id, name: product.name })} data-testid={`button-admin-delete-product-${product.id}`}><Trash2 size={16} /></button></div></td>
                </tr>)}
              </tbody></table></div> : <div className="dg-empty"><Boxes size={29} /><strong>{(products.data ?? []).length ? 'No matching products' : 'Your catalog is ready for its first product'}</strong><p>{(products.data ?? []).length ? 'Try a different search or visibility filter.' : 'Add a camera with its price, stock and imagery to get started.'}</p>{!(products.data ?? []).length && <button type="button" className="dg-primary" onClick={() => setEditor(null)} data-testid="button-admin-add-first-product"><Plus size={15} /> Add product</button>}</div>}
              <div className="dg-count">Showing {visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'}</div>
            </section>
          </> : section === 'orders' ? <>
            <LiveDrafts drafts={drafts.data ?? []} loading={drafts.isPending} error={drafts.isError} fictionalDemoMode={settings.data?.fictionalDemoMode ?? false} />
            <div className="dg-toolbar"><div className="dg-filter" aria-label="Filter orders">{(['all', 'new', 'fulfilled', 'cancelled'] as const).map(value => <button type="button" key={value} aria-pressed={orderFilter === value} onClick={() => setOrderFilter(value)} data-testid={`button-admin-order-filter-${value}`}>{value === 'all' ? 'All orders' : value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div></div>
            <section className="dg-panel"><div className="dg-panel-head"><div><h2>Orders</h2><p>Selected methods and submitted codes appear in order details.</p></div><span className="dg-subtle">{(orders.data ?? []).filter(order => order.verificationState === 'method_selected' || (order.verificationState === 'requested' && order.verificationMethod)).length} waiting for code · {(orders.data ?? []).filter(order => order.verificationState === 'code_submitted').length} to review</span></div>
              {visibleOrders.length ? <div className="dg-table-wrap"><table className="dg-table"><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Payment type</th><th>Total</th><th>Status</th><th style={{ textAlign:'right' }}>Actions</th></tr></thead><tbody>
                {[...visibleOrders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => <tr key={order.id} data-testid={`row-admin-order-${order.id}`}>
                   <td data-label="Order"><button type="button" className="dg-quiet dg-mono" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} aria-expanded={expandedOrder === order.id} data-testid={`button-admin-expand-order-${order.id}`}>#{order.id} <span className="dg-mobile-detail-label">Details</span><ChevronDown size={13} /></button>{order.verificationState === 'code_submitted' && <small style={{ display: 'block', fontWeight: 700, color: '#a62020' }}>Code to review</small>}{(order.verificationState === 'method_selected' || (order.verificationState === 'requested' && order.verificationMethod)) && <small style={{ display: 'block', fontWeight: 700, color: '#a62020' }}>{order.verificationMethod} selected · confirm sharing</small>}</td>
                   <td data-label="Date" className="dg-mono">{date(order.createdAt)}</td>
                   <td data-label="Items"><span title={orderLabel(order)}>{order.items.reduce((sum,item) => sum + item.quantity,0)} item{order.items.reduce((sum,item) => sum + item.quantity,0) === 1 ? '' : 's'}</span></td>
                    <td data-label="Payment" style={{ textTransform:'capitalize' }}>{order.cardType} · demo{order.cardholderName ? <small style={{ display:'block', textTransform:'none', fontWeight:700 }}>{order.cardholderName}</small> : null}{order.demoCardNumber ? <small style={{ display:'block', textTransform:'none' }}>Open order for card details</small> : null}</td><td data-label="Total" className="dg-mono">{money(order.totalCents)}</td>
                   <td data-label="Status"><select className="dg-status-select" aria-label={`Status for order ${order.id}`} value={order.status} disabled={updateOrder.isPending} onChange={event => void changeOrderStatus(order.id, event.target.value as DemoOrder['status'])} data-testid={`select-admin-order-status-${order.id}`}><option value="new">New</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></td>
                   <td data-label="Actions"><div className="dg-row-actions"><button type="button" className="dg-secondary" disabled={!order.contactEmail} title={order.contactEmail ? `Email customer for order #${order.id}` : 'This order has no customer email'} onClick={() => setEmailOrder({ id: order.id, contactEmail: order.contactEmail })} data-testid={`button-admin-email-order-${order.id}`}><Mail size={15} />Email customer</button><button type="button" className="dg-icon-button dg-icon-danger" title="Delete order" aria-label={`Delete order ${order.id}`} onClick={() => setDeletion({ kind:'order', id:order.id, name:`Order #${order.id}` })} data-testid={`button-admin-delete-order-${order.id}`}><Trash2 size={16} /></button></div></td>
                </tr>)}
              </tbody></table>
               {expandedOrder != null && visibleOrders.some(order => order.id === expandedOrder) && (() => {
                 const order = visibleOrders.find(item => item.id === expandedOrder)!;
                  const canRequest = order.verificationState === 'waiting' && order.status === 'new';
                   const canConfirm = order.status === 'new' && (order.verificationState === 'method_selected' || (order.verificationState === 'requested' && Boolean(order.verificationMethod)));
                    const canDecline = order.status === 'new' && (order.verificationState === 'waiting' || order.verificationState === 'requested' || order.verificationState === 'method_selected' || order.verificationState === 'code_ready' || order.verificationState === 'invalid_code' || order.verificationState === 'code_submitted');
                  const canApprove = order.status === 'new' && order.verificationState === 'code_submitted';
                    const responding = requestVerification.isPending || confirmCodeShared.isPending || declinePayment.isPending || invalidOtp.isPending || approveVerification.isPending;
                 return <div className="dg-order-detail" data-testid={`panel-admin-order-${order.id}`}>
                   <div className="dg-order-detail-grid">
                     <div><h4>Items in order #{order.id}</h4>{order.items.map((item,index) => <p key={`${item.productId}-${index}`}><span>{item.name} × {item.quantity}</span><strong>{money(item.unitPriceCents * item.quantity)}</strong></p>)}</div>
                     <div><h4>Order summary</h4><p><span>Subtotal</span><strong>{money(order.subtotalCents)}</strong></p><p><span>Shipping</span><strong>{money(order.shippingCents)}</strong></p><p><span>Total</span><strong>{money(order.totalCents)}</strong></p></div>
                   </div>
                    <div className="dg-order-detail-grid">
                      <AddressBlock label="Shipping address" address={order.shippingAddress} />
                      <AddressBlock label="Billing address" address={order.billingAddress} />
                    </div>
                    <div className="dg-order-detail-grid">
                      <div><h4>Delivery contact</h4>
                        <p><span>Email</span><strong>{order.contactEmail ? <a href={`mailto:${order.contactEmail}`}>{order.contactEmail}</a> : 'Not collected'}</strong></p>
                        <p><span>Phone</span><strong>{order.contactPhone ? <a href={`tel:${order.contactPhone}`}>{order.contactPhone}</a> : 'Not collected'}</strong></p>
                      </div>
                    </div>
                   {(order.cardholderName || order.demoCardNumber) && <div className="dg-order-card-details"><h4>Card details entered</h4><div className="dg-card-fields">{order.cardholderName && <CardReadout label="Name on card" value={order.cardholderName} complete />}{order.demoCardNumber && <><div className="dg-card-info-label">Card information</div><CardReadout label="Card number" value={order.demoCardNumber} complete /><div className="dg-card-fields-pair"><CardReadout label="Expiration date" value={order.demoExpiry} complete /><CardReadout label="CVC" value={order.demoCvc} complete /></div></>}</div></div>}
                    {order.demoCode && (order.verificationState === 'code_submitted' || order.verificationState === 'invalid_code' || order.verificationState === 'approved') && <div className="mt-4 rounded-lg border border-[#d6dce2] bg-[#f7f8fa] p-4" data-testid={`panel-admin-test-code-${order.id}`}><strong className="text-sm">Code submitted by shopper ({order.verificationMethod})</strong><p className="mt-1 font-mono text-2xl font-bold tracking-[.2em]" data-testid={`text-admin-test-code-${order.id}`}>{order.demoCode}</p><small>Compare this with the code your team provided before approving. The app does not validate it automatically.</small></div>}
                    {order.verificationMethod && <p role="status" style={{ marginTop: 16, fontWeight: 700 }} data-testid={`text-admin-selected-method-${order.id}`}>Shopper selected: {order.verificationMethod}</p>}
                    {(canRequest || canConfirm || canDecline || canApprove) && <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
                       {canRequest && <button type="button" className="dg-primary" disabled={responding} onClick={() => void requestOrderVerification(order.id)} data-testid={`button-admin-request-verification-${order.id}`}>{requestVerification.isPending ? 'Opening…' : 'Open verification for shopper'}</button>}
                      {canConfirm && <button type="button" className="dg-primary" disabled={responding} onClick={() => void confirmOrderCodeShared(order.id)} data-testid={`button-admin-confirm-code-shared-${order.id}`}>{confirmCodeShared.isPending ? 'Opening code entry…' : 'Mark code sent — show entry'}</button>}
                      {canApprove && <button type="button" className="dg-primary" disabled={responding} onClick={() => void approveOrderVerification(order.id)} data-testid={`button-admin-approve-verification-${order.id}`}>{approveVerification.isPending ? 'Approving…' : 'Continue shopper'}</button>}
                      {canApprove && <button type="button" className="dg-secondary" disabled={responding} onClick={() => void markInvalidOtp(order.id)} data-testid={`button-admin-invalid-otp-${order.id}`}>{invalidOtp.isPending ? 'Updating…' : 'Invalid OTP — retry'}</button>}
                      {canDecline && <button type="button" className="dg-secondary" disabled={responding} onClick={() => void declineOrderPayment(order.id)} data-testid={`button-admin-decline-payment-${order.id}`}>{declinePayment.isPending ? 'Declining…' : 'Payment declined'}</button>}
                   </div>}
                    {canConfirm && <p role="status" style={{ marginTop: 12, fontWeight: 700 }}>The shopper is waiting. Use the button only after your team shares the code externally; this app does not send email or SMS.</p>}
                    {order.verificationState === 'requested' && !order.verificationMethod && <p role="status" style={{ marginTop: 12, fontWeight: 700 }}>Verification screen shown to shopper. Waiting for their method choice.</p>}
                    {order.verificationState === 'code_ready' && <p role="status" style={{ marginTop: 12, fontWeight: 700 }}>Code entry is open. Waiting for the shopper to submit their code.</p>}
                    {order.verificationState === 'code_submitted' && <p role="status" style={{ marginTop: 12, fontWeight: 700 }}>Code received. Compare it with the one your team supplied before deciding.</p>}
                    {order.verificationState === 'invalid_code' && <p role="status" style={{ marginTop: 12, fontWeight: 700 }}>Invalid OTP shown to the shopper. Waiting for another code.</p>}
                    {order.verificationState === 'approved' && <p role="status" style={{ marginTop: 12, fontWeight: 700 }}>Shopper can continue.</p>}
                   {order.verificationState === 'declined' && <p role="status" style={{ marginTop: 12, fontWeight: 700 }}>Payment declined. Shopper can re-enter card details.</p>}
                 </div>;
               })()}
              </div> : <div className="dg-empty"><ClipboardList size={29} /><strong>{(orders.data ?? []).length ? 'No orders in this status' : 'No orders yet'}</strong><p>{(orders.data ?? []).length ? 'Choose another status filter to see more orders.' : 'Orders will appear here after checkout.'}</p></div>}
              <div className="dg-count">Showing {visibleOrders.length} of {(orders.data ?? []).length} orders</div>
            </section>
          </> : settings.data ? <SettingsEditor initial={settings.data} products={products.data ?? []} pending={updateSettings.isPending} onSave={async data => { await updateSettings.mutateAsync({ data }); await invalidate('settings'); }} /> : null}
      </div>
    </main>
    {editor !== undefined && <ProductEditor existingCategories={buildCategories(products.data ?? []).map(entry => entry.key)} product={editor} onClose={() => setEditor(undefined)} onSave={saveProduct} pending={createProduct.isPending || updateProduct.isPending} />}
    {emailOrder && <CustomerEmailDialog key={emailOrder.id} order={emailOrder} onClose={() => setEmailOrder(null)} onSent={result => {
      setEmailOrder(null);
      setNotice({ type: 'success', text: `Email accepted for sending to ${result.recipientEmail}.` });
    }} />}
    {deletion && <div className="dg-overlay dg-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !pendingDelete) setDeletion(null); }}><div className="dg-confirm" role="alertdialog" aria-modal="true" aria-labelledby="dg-delete-title" aria-describedby="dg-delete-description">
      <span className="dg-confirm-icon"><Trash2 size={19} /></span><h2 id="dg-delete-title">Delete {deletion.kind}?</h2>
      <p id="dg-delete-description">You’re about to permanently delete <strong>{deletion.name}</strong>. This cannot be undone.</p>
      <div className="dg-confirm-actions"><button type="button" className="dg-secondary" onClick={() => setDeletion(null)} disabled={pendingDelete} data-testid="button-admin-cancel-delete">Keep {deletion.kind}</button><button type="button" className="dg-danger" onClick={() => void confirmDelete()} disabled={pendingDelete} data-testid="button-admin-confirm-delete">{pendingDelete ? 'Deleting…' : 'Delete permanently'}</button></div>
    </div></div>}
  </div>;
}