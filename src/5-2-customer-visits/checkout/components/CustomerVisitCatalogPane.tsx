import { useMemo, useState } from 'react';
import { isCatalogProductHidden } from '@/8-2-1-default-prices/lib/catalogKind';
import { Input } from '@/shared/components/ui/input';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCustomerVisitCatalog } from '../hooks/useCustomerVisitCatalog';
import type { CustomerVisitCatalogItem } from '../lib/customerVisitCheckout.types';
import { catalogItemLabel, formatStoreCheckoutRp, isCatalogItemOutOfStock } from '../lib/catalogLabel';

type Props = {
  outletId: string | null;
  submitting?: boolean;
  qtyByCatalogId?: Record<string, number>;
  onAddItem: (item: CustomerVisitCatalogItem) => void;
};

const ALL_CATEGORIES = '__all__';

export function CustomerVisitCatalogPane({ outletId, submitting, qtyByCatalogId = {}, onAddItem }: Props) {
  const { t } = useAppTranslation();
  const catalog = useCustomerVisitCatalog(outletId);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);

  const visibleItems = useMemo(() => {
    return (catalog.data ?? []).filter((item) => item.kind !== 'product' || !isCatalogProductHidden(item.posStatus));
  }, [catalog.data]);

  const productCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of visibleItems) {
      if (item.kind !== 'product' || !item.productCategoryId || !item.productCategoryName) continue;
      map.set(item.productCategoryId, item.productCategoryName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [visibleItems]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleItems.filter((item) => {
      if (item.kind === 'product' && categoryId !== ALL_CATEGORIES) {
        if ((item.productCategoryId ?? '') !== categoryId) return false;
      }
      if (!q) return true;
      return catalogItemLabel(item).toLowerCase().includes(q);
    });
  }, [visibleItems, search, categoryId]);

  const products = useMemo(
    () => filteredCatalog.filter((item) => item.kind === 'product'),
    [filteredCatalog],
  );
  const services = useMemo(
    () => filteredCatalog.filter((item) => item.kind !== 'product'),
    [filteredCatalog],
  );

  const renderBody = () => {
    if (catalog.isLoading) {
      return <p className="text-sm text-gray-500">{t('customerVisits.checkout.loadingCatalog', 'Loading catalog…')}</p>;
    }
    if (catalog.isError) {
      return <p className="text-sm text-gray-600">{t('customerVisits.checkout.catalogError', 'Could not load catalog.')}</p>;
    }
    if (visibleItems.length === 0) {
      return (
        <p className="text-sm text-gray-600">
          {t(
            'customerVisits.checkout.emptyCatalog',
            'No catalog items yet. Add them in Products & Services before taking store payments.',
          )}
        </p>
      );
    }
    if (filteredCatalog.length === 0) {
      return <p className="text-sm text-gray-500">{t('customerVisits.checkout.noCatalogMatch', 'No matching items.')}</p>;
    }

    return (
      <div className="space-y-4">
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('customerVisits.checkout.products', 'Products')}
          </p>
          {products.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              {t('customerVisits.checkout.emptyProducts', 'No products yet.')}
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((item) => {
                const out = isCatalogItemOutOfStock(item);
                const qty = qtyByCatalogId[item.id] ?? 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="relative flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left hover:border-brand-blue disabled:opacity-50"
                    onClick={() => onAddItem(item)}
                    disabled={submitting || !(item.unitPrice > 0) || out}
                  >
                    {qty > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-brand-blue px-1.5 text-center text-[10px] font-semibold leading-5 text-white">
                        {qty}
                      </span>
                    ) : null}
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded bg-gray-100" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900">{catalogItemLabel(item)}</span>
                      {out ? (
                        <span className="block text-xs text-gray-500">
                          {t('customerVisits.checkout.outOfStock', 'Out of stock')}
                        </span>
                      ) : item.trackStock ? (
                        <span className="block text-xs text-gray-500">
                          {t('customerVisits.checkout.stockLeft', '{{qty}} left', {
                            qty: item.availableQty ?? 0,
                          })}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-600">
                      {formatStoreCheckoutRp(item.unitPrice)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('customerVisits.checkout.services', 'Services')}
          </p>
          {services.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              {t('customerVisits.checkout.emptyServices', 'No services yet.')}
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {services.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left hover:border-brand-blue"
                  onClick={() => onAddItem(item)}
                  disabled={submitting || !(item.unitPrice > 0)}
                >
                  <span className="min-w-0 truncate text-sm text-gray-900">{catalogItemLabel(item)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-600">
                    {formatStoreCheckoutRp(item.unitPrice)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex-shrink-0 border-b px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('customerVisits.checkout.title', 'Store checkout')}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {t('customerVisits.checkout.subtitle', 'Add items, then take payment.')}
        </p>
        <Input
          className="mt-2 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('customerVisits.checkout.searchCatalog', 'Search catalog…')}
        />
        {productCategories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`rounded-full border px-2.5 py-1 text-xs ${
                categoryId === ALL_CATEGORIES
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
              onClick={() => setCategoryId(ALL_CATEGORIES)}
            >
              {t('customerVisits.checkout.allCategories', 'All')}
            </button>
            {productCategories.map(([id, name]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  categoryId === id
                    ? 'border-brand-blue bg-brand-blue text-white'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
                onClick={() => setCategoryId(id)}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {renderBody()}
      </div>
    </div>
  );
}
