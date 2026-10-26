import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Image as ImageIcon, PackageSearch, Search, X } from 'lucide-react';
import { api } from '../lib/api';

interface SellerVariant {
  id: number;
  size: string;
  type: string | null;
  color: string | null;
  height: string | null;
  price: number;
  stocks: { quantity: number }[];
}

interface SellerProduct {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  warrantySeal: string | null;
  category: { name: string };
  variants: SellerVariant[];
}

const money = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function stockFor(variant: SellerVariant) {
  return variant.stocks[0]?.quantity ?? 0;
}

export function SellerCatalogPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [selectedProduct, setSelectedProduct] = useState<SellerProduct | null>(null);
  const navigate = useNavigate();

  const { data: products = [], isLoading, isError, refetch } = useQuery<SellerProduct[]>({
    queryKey: ['seller-catalog'],
    queryFn: async () => (await api.get('/catalog/seller')).data,
    staleTime: 30_000,
  });

  const categories = useMemo(
    () => ['Todas', ...new Set(products.map((product) => product.category.name))],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === 'Todas' || product.category.name === category;
      const matchesSearch = !term || [
        product.name,
        product.sku,
        product.category.name,
        ...product.variants.map((variant) => `${variant.size} ${variant.type ?? ''} ${variant.color ?? ''}`),
      ].some((value) => value.toLocaleLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [products, category, search]);

  const inStockCount = products.reduce(
    (total, product) => total + product.variants.filter((variant) => stockFor(variant) > 0).length,
    0,
  );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-secondary px-6 py-7 text-white sm:px-8">
        <p className="text-sm font-semibold text-white/70">ATENCIÓN AL CLIENTE</p>
        <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold">Galería de productos</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Explora modelos, compara medidas y precios, y muestra las opciones disponibles en tu sucursal.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-sm">
            <span className="font-bold">{inStockCount}</span> variantes disponibles
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            className="input pl-10"
            type="search"
            placeholder="Buscar por modelo, código, medida o color…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          className="input sm:max-w-xs"
          aria-label="Filtrar por categoría"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </section>

      {isLoading && <p className="py-10 text-center text-muted">Cargando catálogo…</p>}
      {isError && (
        <div className="card py-8 text-center">
          <p className="text-danger">No se pudo cargar el catálogo.</p>
          <button className="btn-secondary mt-4" onClick={() => void refetch()}>Reintentar</button>
        </div>
      )}
      {!isLoading && !isError && (
        <>
          <p className="text-sm text-muted">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'modelo' : 'modelos'}
          </p>
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const available = product.variants.filter((variant) => stockFor(variant) > 0);
                const startingPrice = product.variants.length
                  ? Math.min(...product.variants.map((variant) => variant.price))
                  : null;

                return (
                  <article key={product.id} className="card overflow-hidden p-0">
                    <button
                      className="group block w-full text-left"
                      onClick={() => setSelectedProduct(product)}
                      aria-label={`Ver ${product.name}`}
                    >
                      <div className="relative flex h-56 items-center justify-center overflow-hidden bg-page">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted">
                            <ImageIcon size={42} strokeWidth={1.3} />
                            <span className="text-xs">Imagen no disponible</span>
                          </div>
                        )}
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
                          {product.category.name}
                        </span>
                        {product.warrantySeal && (
                          <span className="absolute right-3 top-3 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-white shadow-sm">
                            Garantía {product.warrantySeal}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="text-lg font-bold leading-tight">{product.name}</h2>
                          <ArrowRight size={18} className="mt-1 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-primary" />
                        </div>
                        {product.description && (
                          <p className="line-clamp-2 min-h-10 text-sm text-muted">{product.description}</p>
                        )}
                        <div className="flex items-end justify-between border-t border-line pt-3">
                          <span className="text-xs text-muted">
                            {available.length} de {product.variants.length} variantes disponibles
                          </span>
                          {startingPrice !== null && (
                            <span className="text-right">
                              <span className="block text-[11px] text-muted">Desde</span>
                              <span className="font-bold text-primary">Bs {money.format(startingPrice)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-line py-12 text-center">
              <PackageSearch className="mx-auto mb-3 text-muted" size={32} />
              <p className="font-medium">No encontramos modelos</p>
              <p className="mt-1 text-sm text-muted">Prueba con otro nombre, medida o categoría.</p>
            </div>
          )}
        </>
      )}

      {selectedProduct && (
        <ProductPresentation
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onStartSale={(variantId) => navigate(`/ventas/nueva?variantId=${variantId}`)}
        />
      )}
    </div>
  );
}

function ProductPresentation({
  product,
  onClose,
  onStartSale,
}: {
  product: SellerProduct;
  onClose: () => void;
  onStartSale: (variantId: number) => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants.find((variant) => stockFor(variant) > 0)?.id ?? product.variants[0]?.id ?? null,
  );
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const available = selectedVariant ? stockFor(selectedVariant) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="relative grid max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-surface md:grid-cols-2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="presentation-title"
      >
        <button
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-ink shadow hover:bg-white"
          aria-label="Cerrar presentación"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="flex min-h-64 items-center justify-center bg-page md:min-h-[32rem]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full max-h-[32rem] w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted">
              <ImageIcon size={56} strokeWidth={1.2} />
              <span className="text-sm">Imagen no disponible</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-secondary dark:text-secondary">
              {product.category.name}
            </span>
            <h2 id="presentation-title" className="mt-2 text-3xl font-bold">{product.name}</h2>
            {product.description && <p className="mt-3 leading-relaxed text-muted">{product.description}</p>}
            {product.warrantySeal && (
              <p className="mt-3 inline-flex rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
                Garantía: {product.warrantySeal}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Elige medida y acabado</h3>
            {product.variants.map((variant) => {
              const quantity = stockFor(variant);
              const isSelected = selectedVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected ? 'border-secondary bg-secondary/5 ring-1 ring-secondary dark:border-blue-300' : 'border-line hover:border-secondary/50'
                  }`}
                  onClick={() => setSelectedVariantId(variant.id)}
                >
                  <span>
                    <span className="block font-semibold">
                      {variant.size}{variant.height ? ` · ${variant.height}` : ''}{variant.type ? ` · ${variant.type}` : ''}
                    </span>
                    {variant.color && <span className="text-sm text-muted">Color: {variant.color}</span>}
                    <span className={`mt-1 block text-xs ${quantity > 0 ? 'text-success' : 'text-danger'}`}>
                      {quantity > 0 ? `${quantity} disponibles en sucursal` : 'Agotado en esta sucursal'}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-lg font-bold text-primary">Bs {money.format(variant.price)}</span>
                </button>
              );
            })}
            {product.variants.length === 0 && (
              <p className="rounded-lg bg-page p-3 text-sm text-muted">Este modelo no tiene variantes activas.</p>
            )}
          </div>

          <div className="mt-auto">
            <button
              className="btn-primary w-full"
              disabled={!selectedVariant || available < 1}
              onClick={() => selectedVariant && onStartSale(selectedVariant.id)}
            >
              {available > 0 ? 'Iniciar venta con esta variante' : 'No disponible para venta'}
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              El precio final se confirma al registrar la venta.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
