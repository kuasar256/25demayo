import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Search, Plus, X, Save, Upload, Image, Trash2, Maximize2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

const SIZE_OPTIONS = [
  'Plaza y media',
  '2 Plazas',
  'Dos plazas',
  '3 Plazas',
  '3 Cuerpos',
];

const REMOVED_SIZE_OPTIONS = new Set(['1 plaza', '1.5 plazas', '2.5 plazas', 'estandar']);

function normalizeSize(size: string) {
  return size.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function categorySkuPrefix(categoryName: string) {
  const words = categoryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];
  const categoryCode = words.length > 1
    ? words.map((word) => word[0]).join('').slice(0, 3)
    : (words[0] ?? 'PRO').slice(0, 3);
  return `PROD-${categoryCode}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nextSku(prefix: string, existingSkus: string[]) {
  const sequencePattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const highest = existingSkus.reduce((max, sku) => {
    const match = sku.match(sequencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
}

function nextVariantSku(productSku: string, variants: any[]) {
  const prefix = `${productSku}-`;
  const highest = variants.reduce((max, variant) => {
    const match = String(variant.sku ?? '').match(new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

const COLOR_OPTIONS = [
  'Beige',
  'Blanco',
  'Blanco/Gris',
  'Azul',
  'Café',
  'Galleta',
  'Gris',
  'Mostaza',
  'Negro',
  'Plomo',
  'Rojo',
  'Rosado',
  'Verde',
  'Vino',
  'Marrón',
];

const HEIGHT_OPTIONS = ['1.40 m', '1.20 m'];

function sizeOptionsForCategory(categoryName: string, existingSizes: string[] = []) {
  const category = categoryName.toLocaleLowerCase();
  let options: string[];
  if (category.includes('velador')) {
    options = ['Unidad'];
  } else if (category.includes('espaldar') || category.includes('respaldo')) {
    options = SIZE_OPTIONS.filter((size) => size !== '3 Cuerpos');
  } else if (category.includes('colch') || category.includes('cama') || category.includes('catre')) {
    options = SIZE_OPTIONS.filter((size) => size !== '3 Cuerpos');
  } else {
    options = ['Unidad', '1.40 m (alto)', 'Bajo sin espaldar', '3 Cuerpos'];
  }
  return [...new Set([...options, ...existingSizes.filter(Boolean)])]
    .filter((size) => !REMOVED_SIZE_OPTIONS.has(normalizeSize(size)));
}

function hasHeight(categoryName: string) {
  const category = categoryName.toLocaleLowerCase();
  return category.includes('espaldar') || category.includes('respaldo') || category.includes('velador');
}

function hasStoredHeight(size: string) {
  const normalized = normalizeSize(size);
  return normalized.includes('m (alto)') || normalized.includes('sin espaldar');
}

async function uploadProductImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/upload/image', form);
  return data.url as string;
}

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const [expandedCatalog, setExpandedCatalog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: products, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => (await api.get('/catalog/products', { params: { search } })).data,
  });

  const canManage = ['ADMIN_GENERAL', 'ADMIN'].includes(user?.role || '');

  const getFallbackImage = (product: any) => {
    if (product.imageUrl) return product.imageUrl;
    const name = product.name.toLowerCase();
    if (name.includes('colchón') || name.includes('colchon')) return 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=400&auto=format&fit=crop';
    if (name.includes('cama') || name.includes('somier')) return 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=400&auto=format&fit=crop';
    if (name.includes('velador')) return 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?q=80&w=400&auto=format&fit=crop';
    if (name.includes('living') || name.includes('sofa')) return 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=400&auto=format&fit=crop';
    return 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=400&auto=format&fit=crop';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
          <p className="text-sm text-muted">Galería oficial de modelos y variantes.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => setExpandedCatalog(true)}>
            <Maximize2 size={18} /> Ampliar catálogo
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              className="input pl-9 max-w-xs" 
              placeholder="Buscar modelos..."
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          {canManage && (
            <button className="btn-primary flex items-center gap-1" onClick={() => setShowNewProduct(true)}>
              <Plus size={18} /> Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {isLoading ? <p className="text-muted">Cargando galería...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(products ?? []).map((p: any) => (
            <div key={p.id} className="card p-0 overflow-hidden flex flex-col hover:shadow-lg transition-shadow border border-line">
              <div className="h-48 w-full bg-page relative">
                <img src={getFallbackImage(p)} alt={p.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 flex gap-1">
                  <span className="badge bg-white/90 text-ink shadow-sm border border-line/50 backdrop-blur-sm">{p.category?.name}</span>
                  {p.warrantySeal && (
                    <span className="badge bg-secondary/90 text-white shadow-sm backdrop-blur-sm">{p.warrantySeal}</span>
                  )}
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-ink leading-tight">{p.name}</h3>
                  <p className="text-xs text-muted">SKU: {p.sku}</p>
                  {p.description && <p className="text-sm text-muted mt-2 line-clamp-2">{p.description}</p>}
                </div>

                <div className="mt-auto">
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Variantes y Precios</h4>
                  <div className="space-y-2">
                    {p.variants.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between bg-page p-2 rounded-lg text-sm border border-line/50">
                        <div className="flex flex-col">
                          <span className="font-medium text-ink">{v.size}{v.height ? ` · ${v.height}` : ''}</span>
                          {v.color && <span className="text-xs text-muted flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
                            {v.color}
                          </span>}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-primary">Bs {v.price.toFixed(2)}</span>
                          {canManage && v.costPrice > 0 && (
                            <p className="text-[10px] text-muted">Costo: Bs {v.costPrice.toFixed(2)}</p>
                          )}
                          <p className="text-[10px] text-muted">SKU: {v.sku} · {v.warrantyYears ?? 1} {(v.warrantyYears ?? 1) === 1 ? 'año' : 'años'} gar.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {canManage && (
                <div className="px-4 py-3 bg-page/50 border-t border-line flex justify-end gap-2">
                  <button className="text-sm font-medium text-secondary hover:underline" onClick={() => setEditingProduct(p)}>
                    Editar Detalles
                  </button>
                </div>
              )}
            </div>
          ))}
          {(products ?? []).length === 0 && (
            <div className="col-span-full py-12 text-center text-muted border-2 border-dashed border-line rounded-xl">
              No se encontraron productos en el catálogo.
            </div>
          )}
        </div>
      )}

      {expandedCatalog && <ExpandedCatalog products={products ?? []} loading={isLoading} error={isError}
        search={search} onSearch={setSearch} onRetry={() => void refetch()} onClose={() => setExpandedCatalog(false)} />}
      {editingProduct && <ProductEditModal product={editingProduct} onClose={() => setEditingProduct(null)} />}
      {showNewProduct && <NewProductModal onClose={() => setShowNewProduct(false)} />}
    </div>
  );
}

// Vista de consulta: conserva búsqueda y permisos de la consulta original.
function ExpandedCatalog({ products, loading, error, search, onSearch, onRetry, onClose }: {
  products: any[]; loading: boolean; error: boolean; search: string;
  onSearch: (value: string) => void; onRetry: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const catalogScroll = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(products.length / 9));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = products.slice((currentPage - 1) * 9, currentPage * 9);
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { catalogScroll.current?.scrollTo({ top: 0 }); }, [currentPage, search]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  const price = (value: number) => 'Bs ' + new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return createPortal(
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }}
      aria-labelledby="expanded-catalog-title"
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-page p-0 text-ink backdrop:bg-black/50">
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-line bg-white px-5 py-4 dark:bg-surface sm:px-10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Colchones 25 de Mayo</p>
              <h2 id="expanded-catalog-title" className="mt-1 text-2xl font-bold">Nuestro catálogo</h2>
              <p className="mt-1 text-sm text-muted">Modelos, medidas y precios en una vista más amplia.</p>
            </div>
            <button autoFocus type="button" className="btn-secondary flex items-center gap-2" onClick={onClose}>
              <X size={18} /> Volver al catálogo
            </button>
          </div>
          <div className="mx-auto mt-5 flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <label className="relative block w-full sm:max-w-md">
              <span className="sr-only">Buscar productos en el catálogo ampliado</span>
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" className="input pl-10" value={search} onChange={event => onSearch(event.target.value)} placeholder="Buscar un producto…" />
            </label>
            <span className="text-sm text-muted" role="status">{loading ? 'Cargando productos…' : error ? '' : products.length + (products.length === 1 ? ' producto' : ' productos')}</span>
          </div>
        </header>
        <div ref={catalogScroll} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-8">
          {loading ? <p className="py-16 text-center text-muted" role="status">Cargando catálogo…</p>
            : error ? <div className="py-16 text-center" role="alert"><p>No se pudo cargar el catálogo.</p><button type="button" className="btn-secondary mt-4" onClick={onRetry}>Reintentar</button></div>
            : products.length === 0 ? <p className="py-16 text-center text-muted">No se encontraron productos. Prueba con otra búsqueda.</p>
            : <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map(product => <article key={product.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm dark:bg-surface">
                <div className="flex aspect-[4/3] items-center justify-center bg-page p-4">
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-contain" />
                    : <div className="text-center text-muted"><Image size={48} className="mx-auto mb-2" /><span className="text-sm">Imagen no disponible</span></div>}
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{product.category?.name || 'Producto'}</p>
                  <h3 className="mt-2 text-xl font-bold">{product.name}</h3>
                  {product.description && <p className="mt-3 text-sm leading-relaxed text-muted">{product.description}</p>}
                  {product.warrantySeal && <p className="mt-3 text-xs font-medium text-secondary">{product.warrantySeal}</p>}
                  <div className="mt-5 space-y-3 border-t border-line pt-4">
                    {(product.variants ?? []).map((variant: any) => <div key={variant.id} className="flex items-start justify-between gap-4">
                      <div className="min-w-0"><p className="text-sm font-medium">{variant.size}{variant.height ? ' · ' + variant.height : ''}</p>
                        {variant.color && <p className="mt-1 text-xs text-muted">{variant.color}</p>}
                        <p className="mt-1 text-xs text-muted">{variant.warrantyYears ?? 1} {(variant.warrantyYears ?? 1) === 1 ? 'año' : 'años'} de garantía</p>
                      </div>
                      <strong className="shrink-0 text-base text-primary">{price(Number(variant.price))}</strong>
                    </div>)}
                    {!(product.variants ?? []).length && <p className="text-sm text-muted">Sin variantes disponibles.</p>}
                  </div>
                </div>
              </article>)}
            </div>}
        </div>
        {!loading && !error && products.length > 0 && <footer className="shrink-0 border-t border-line bg-white px-5 py-3 dark:bg-surface sm:px-10">
          <nav aria-label="Páginas del catálogo" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">Mostrando {(currentPage - 1) * 9 + 1}–{Math.min(currentPage * 9, products.length)} de {products.length} productos · 9 por página</p>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
              <span className="text-sm text-muted">{currentPage} / {pageCount}</span>
              <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
            </div>
          </nav>
        </footer>}
      </div>
    </dialog>, document.body,
  );
}

// ========== MODAL EDITAR PRODUCTO ==========
function ProductEditModal({ product, onClose }: { product: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [categoryId, setCategoryId] = useState(String(product.categoryId));
  const [description, setDescription] = useState(product.description || '');
  const [warrantySeal, setWarrantySeal] = useState(product.warrantySeal || '');
  const [imageUrl, setImageUrl] = useState(product.imageUrl || '');
  const [uploading, setUploading] = useState(false);
  const productCategoryName = product.category?.name ?? '';
  const [variants, setVariants] = useState<any[]>(product.variants.map((v: any) => ({
    ...v,
    costPrice: v.costPrice ?? 0,
    warrantyYears: v.warrantyYears ?? 1,
    size: hasStoredHeight(v.size)
      ? sizeOptionsForCategory(productCategoryName)[0] ?? 'Unidad'
      : v.size,
    height: v.height || (hasStoredHeight(v.size) ? v.size.replace(/\s*\(alto\)/i, '') : ''),
  })));
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/catalog/categories')).data,
  });
  const selectedCategory = categories?.find((category: any) => String(category.id) === categoryId);
  const selectedCategoryName = selectedCategory?.name ?? product.category?.name ?? '';
  const showHeight = hasHeight(selectedCategoryName);
  const sizeOptions = sizeOptionsForCategory(selectedCategoryName, variants.map((variant) => variant.size));
  const colorOptions = [...new Set([...COLOR_OPTIONS, ...variants.map((variant) => variant.color).filter(Boolean)])];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadProductImage(file));
      toast.success('Imagen subida correctamente');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al subir la imagen');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const updateProductMut = useMutation({
    mutationFn: async () => {
      await api.patch(`/catalog/products/${product.id}`, {
        categoryId: Number(categoryId), name, sku, description, warrantySeal, imageUrl,
      });
      const categoryName = categories?.find((category: any) => String(category.id) === categoryId)?.name ?? product.category?.name ?? '';
      await api.patch(`/catalog/products/${product.id}/variants`, {
        variants: variants.map((variant) => ({
          ...(variant.id ? { id: variant.id } : {}),
          size: variant.size,
          color: variant.color || undefined,
          height: hasHeight(categoryName) ? variant.height || null : null,
          price: Number(variant.price),
          costPrice: Number(variant.costPrice || 0),
          warrantyYears: Number(variant.warrantyYears || 1),
          minStock: Number(variant.minStock),
          sku: variant.sku,
        })),
      });
    },
    onSuccess: () => {
      toast.success('Producto actualizado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['seller-catalog'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al actualizar'),
  });

  const handleVariantChange = (index: number, field: string, value: any) => {
    const copy = [...variants];
    copy[index][field] = value;
    setVariants(copy);
  };

  const addVariant = () => {
    setVariants((current) => {
      const suffix = `${Date.now()}-${current.length + 1}`;
      const currentSizes = sizeOptionsForCategory(selectedCategoryName, current.map((variant) => variant.size));
      return [
        ...current,
        {
          localId: `new-${suffix}`,
          size: currentSizes[0] ?? 'Unidad',
          color: '',
          height: '',
          price: 0,
          costPrice: 0,
          warrantyYears: 1,
          minStock: 0,
          sku: nextVariantSku(sku || product.sku, current),
        },
      ];
    });
  };

  const removeVariant = (index: number) => {
    setVariants((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-card shadow-card w-full max-w-3xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-line shrink-0">
          <h2 className="text-xl font-bold">Editar Producto</h2>
          <button onClick={onClose} className="p-1 hover:bg-page rounded-full transition text-muted"><X size={20} /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); updateProductMut.mutate(); }} className="flex flex-col overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <section>
              <h3 className="font-bold text-secondary mb-3">Detalles Generales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre del Modelo</label>
                  <input required className="input" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Código Base (SKU)</label>
                  <input required className="input" value={sku} onChange={e => setSku(e.target.value)} />
                </div>
                <div>
                  <label className="label">Categoría *</label>
                  <select required className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">Seleccionar categoría...</option>
                    {(categories ?? []).map((category: any) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Descripción</label>
                  <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                  <label className="label">Sello de Garantía</label>
                  <input className="input" placeholder="Ej. 5 Años" value={warrantySeal} onChange={e => setWarrantySeal(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Imagen */}
            <section>
              <h3 className="font-bold text-secondary mb-3">Imagen del Producto</h3>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-line shrink-0" />
                ) : (
                  <div className="w-32 h-32 bg-page rounded-lg border-2 border-dashed border-line flex items-center justify-center shrink-0">
                    <Image size={32} className="text-muted" />
                  </div>
                )}
                <div className="flex-1 w-full space-y-2">
                  <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer w-max">
                    <Upload size={16} />
                    {uploading ? 'Subiendo...' : 'Subir Imagen desde el equipo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                  <p className="text-xs text-muted">O pega una URL directamente:</p>
                  <input className="input text-sm" placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Variantes */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="font-bold text-secondary">Variantes (Medidas, Colores, Altura y Precios)</h3>
                <button type="button" className="btn-secondary inline-flex items-center gap-1 text-sm" onClick={addVariant}>
                  <Plus size={16} /> Agregar variante
                </button>
              </div>
              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div key={v.id ?? v.localId} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 bg-page p-3 rounded-lg border border-line">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">Medida</label>
                      <select required className="input py-1 text-sm" value={v.size} onChange={e => handleVariantChange(i, 'size', e.target.value)}>
                        {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">Color</label>
                      <select className="input py-1 text-sm" value={v.color || ''} onChange={e => handleVariantChange(i, 'color', e.target.value)}>
                        <option value="">Sin color</option>
                        {colorOptions.map((color) => <option key={color} value={color}>{color}</option>)}
                      </select>
                    </div>
                    {showHeight && (
                      <div>
                        <label className="text-[10px] uppercase font-bold text-muted">Altura</label>
                        <select
                          className="input py-1 text-sm"
                          value={v.height || ''}
                          onChange={e => handleVariantChange(i, 'height', e.target.value)}
                        >
                          <option value="">Selecciona altura...</option>
                          {HEIGHT_OPTIONS.map((height) => <option key={height} value={height}>{height}</option>)}
                          {v.height && !HEIGHT_OPTIONS.includes(v.height) && <option value={v.height}>{v.height}</option>}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">Precio (Bs)</label>
                      <input required type="number" step="0.01" className="input py-1 text-sm font-bold text-primary" value={v.price} onChange={e => handleVariantChange(i, 'price', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">Costo Fab. (Bs)</label>
                      <input type="number" step="0.01" min="0" className="input py-1 text-sm" value={v.costPrice ?? 0} onChange={e => handleVariantChange(i, 'costPrice', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">Garantía (Años)</label>
                      <input type="number" min="0" max="25" className="input py-1 text-sm" value={v.warrantyYears ?? 1} onChange={e => handleVariantChange(i, 'warrantyYears', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">Stock Mín.</label>
                      <input required type="number" className="input py-1 text-sm" value={v.minStock} onChange={e => handleVariantChange(i, 'minStock', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">SKU Variante</label>
                      <input required className="input py-1 text-sm" value={v.sku} onChange={e => handleVariantChange(i, 'sku', e.target.value)} />
                    </div>
                    <button
                      type="button"
                      className="col-span-2 md:col-span-4 lg:col-span-8 inline-flex items-center justify-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                      onClick={() => removeVariant(i)}
                      aria-label={`Quitar variante ${v.size}${v.color ? ` ${v.color}` : ''}`}
                    >
                      <Trash2 size={15} /> Quitar variante
                    </button>
                  </div>
                ))}
                {variants.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">
                    Este producto no tiene variantes. Agrega una para definir plaza, color y precio.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-line shrink-0 bg-page/30">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={updateProductMut.isPending}>
              <Save size={18} /> {updateProductMut.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== MODAL NUEVO PRODUCTO ==========
function NewProductModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [warrantySeal, setWarrantySeal] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/catalog/categories')).data,
  });
  const { data: catalogProducts } = useQuery({
    queryKey: ['products', 'sku-sequence'],
    queryFn: async () => (await api.get('/catalog/products')).data,
  });
  const selectedCategory = categories?.find((category: any) => String(category.id) === categoryId);
  const showHeight = hasHeight(selectedCategory?.name ?? '');
  const sizeOptions = sizeOptionsForCategory(selectedCategory?.name ?? '', variants.map((variant) => variant.size));

  const selectCategory = (value: string) => {
    setCategoryId(value);
    setVariants([]);
    const category = categories?.find((item: any) => String(item.id) === value);
    if (!category) {
      setSku('');
      return;
    }
    const prefix = categorySkuPrefix(category.name);
    const existingSkus = (catalogProducts ?? []).map((product: any) => product.sku);
    setSku(nextSku(prefix, existingSkus));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadProductImage(file));
      toast.success('Imagen subida');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al subir imagen');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (variants.length === 0) throw new Error('Agrega al menos una variante al producto.');
      return (await api.post('/catalog/products', {
        categoryId: Number(categoryId),
        name,
        sku,
        description,
        warrantySeal,
        imageUrl,
        variants: variants.map((variant) => ({
          size: variant.size,
          color: variant.color || undefined,
          height: showHeight ? variant.height || undefined : undefined,
          price: Number(variant.price),
          costPrice: Number(variant.costPrice || 0),
          warrantyYears: Number(variant.warrantyYears || 1),
          minStock: Number(variant.minStock),
          sku: variant.sku,
        })),
      })).data;
    },
    onSuccess: () => {
      toast.success('Producto y variantes creados correctamente.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['seller-catalog'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message || 'Error al crear producto'),
  });

  const addVariant = () => {
    setVariants((current) => {
      const suffix = `${Date.now()}-${current.length + 1}`;
      const variantSizes = sizeOptionsForCategory(selectedCategory?.name ?? '', current.map((variant) => variant.size));
      return [
        ...current,
        {
          localId: `new-${suffix}`,
          size: variantSizes[0] ?? 'Unidad',
          color: '',
          height: '',
          price: 0,
          costPrice: 0,
          warrantyYears: 1,
          minStock: 0,
          sku: nextVariantSku(sku || 'PROD-000', current),
        },
      ];
    });
  };

  const updateVariant = (index: number, field: string, value: string | number) => {
    setVariants((current) => current.map((variant, currentIndex) =>
      currentIndex === index ? { ...variant, [field]: value } : variant,
    ));
  };

  const handleProductSkuChange = (value: string) => {
    const previousSku = sku;
    setSku(value);
    setVariants((current) => current.map((variant) => {
      const generatedSuffix = String(variant.sku ?? '').match(new RegExp(`^${escapeRegExp(previousSku)}-(\\d+)$`))?.[1];
      return generatedSuffix ? { ...variant, sku: `${value}-${generatedSuffix}` } : variant;
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-card shadow-card w-full max-w-3xl my-8 max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-xl font-bold">Nuevo Producto</h2>
          <button onClick={onClose} className="p-1 hover:bg-page rounded-full text-muted"><X size={20} /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="flex flex-col overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="label">Categoría *</label>
            <select
              required
              className="input"
              value={categoryId}
              disabled={!catalogProducts}
              onChange={(e) => selectCategory(e.target.value)}
            >
              <option value="">{catalogProducts ? 'Selecciona la categoría antes de agregar variantes...' : 'Cargando categorías y SKU...'}</option>
              {(categories ?? []).map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input required className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Colchón Pocket Premium" />
            </div>
            <div>
              <label className="label">SKU *</label>
              <input required className="input" value={sku} onChange={e => handleProductSkuChange(e.target.value)} placeholder="Selecciona categoría para generar SKU" />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Garantía</label>
              <input className="input" value={warrantySeal} onChange={e => setWarrantySeal(e.target.value)} placeholder="Ej. 3 Años" />
            </div>
            <div>
              <label className="label">Imagen del producto</label>
              <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer w-full justify-center">
                <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir Foto'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
          </div>
          {imageUrl && (
            <div className="flex items-start gap-3">
              <img src={imageUrl} alt="Vista previa del producto" className="w-28 h-28 object-cover rounded-lg border border-line" />
              <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setImageUrl('')}>
                Quitar imagen
              </button>
            </div>
          )}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-bold text-secondary">Variantes del producto</h3>
                <p className="text-xs text-muted">
                  {selectedCategory
                    ? `Las variantes pertenecerán a la categoría ${selectedCategory.name}.`
                    : 'Primero elige una categoría para configurar sus medidas.'}
                </p>
              </div>
              <button type="button" className="btn-secondary inline-flex items-center gap-1 text-sm" onClick={addVariant} disabled={!categoryId}>
                <Plus size={16} /> Agregar variante
              </button>
            </div>
            <div className="space-y-3">
              {variants.map((variant, index) => (
                <div key={variant.localId} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 bg-page p-3 rounded-lg border border-line">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted">Medida</label>
                    <select required className="input py-1 text-sm" value={variant.size} onChange={(e) => updateVariant(index, 'size', e.target.value)}>
                      {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted">Color</label>
                    <select className="input py-1 text-sm" value={variant.color} onChange={(e) => updateVariant(index, 'color', e.target.value)}>
                      <option value="">Sin color</option>
                      {COLOR_OPTIONS.map((color) => <option key={color} value={color}>{color}</option>)}
                    </select>
                  </div>
                  {hasHeight(selectedCategory?.name ?? '') && (
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted">Altura</label>
                      <select
                        className="input py-1 text-sm"
                        value={variant.height}
                        onChange={(e) => updateVariant(index, 'height', e.target.value)}
                      >
                        <option value="">Selecciona altura...</option>
                        {HEIGHT_OPTIONS.map((height) => <option key={height} value={height}>{height}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted">Precio (Bs)</label>
                    <input required min="0" type="number" step="0.01" className="input py-1 text-sm" value={variant.price} onChange={(e) => updateVariant(index, 'price', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted">Costo Fab. (Bs)</label>
                    <input min="0" type="number" step="0.01" className="input py-1 text-sm" value={variant.costPrice ?? 0} onChange={(e) => updateVariant(index, 'costPrice', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted">Garantía (Años)</label>
                    <input min="0" max="25" type="number" className="input py-1 text-sm" value={variant.warrantyYears ?? 1} onChange={(e) => updateVariant(index, 'warrantyYears', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted">Stock mínimo</label>
                    <input required min="0" type="number" className="input py-1 text-sm" value={variant.minStock} onChange={(e) => updateVariant(index, 'minStock', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted">SKU variante</label>
                    <input required className="input py-1 text-sm" value={variant.sku} onChange={(e) => updateVariant(index, 'sku', e.target.value)} />
                  </div>
                  <button
                    type="button"
                    className="col-span-2 md:col-span-4 lg:col-span-8 inline-flex items-center justify-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                    onClick={() => setVariants((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    <Trash2 size={15} /> Quitar variante
                  </button>
                </div>
              ))}
              {!variants.length && (
                <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">
                  Selecciona una categoría y agrega al menos una variante.
                </p>
              )}
            </div>
          </section>
          </div>
          <div className="flex justify-end gap-3 p-4 border-t border-line shrink-0 bg-page/30">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={createMut.isPending || uploading || !variants.length}>
              {createMut.isPending ? 'Creando...' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
