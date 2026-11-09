import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/app/layouts/MainLayout";
import { getOrganizationMemberships, requireOrganizationSession } from "@/app/lib/auth";
import {
  adjustInventoryAction,
  archiveProductAction,
  createProductAction,
  createProductCategoryAction,
  restoreProductAction,
  updateProductAction,
  updateProductCategoryAction,
} from "@/app/lib/product-actions";
import { getProductCatalog } from "@/app/lib/product-queries";

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await requireOrganizationSession();
  const [params, memberships, catalog] = await Promise.all([
    searchParams,
    getOrganizationMemberships(session.userId),
    getProductCatalog(session.organization.id),
  ]);
  const editor = session.organization.role !== "viewer";
  const activeProducts = catalog.products.filter((product) => !product.archivedAt);
  const archivedProducts = catalog.products.filter((product) => product.archivedAt);
  const lowStock = activeProducts.filter((product) => product.stockQuantity <= product.lowStockThreshold);
  const updated = firstParam(params.updated);
  const error = firstParam(params.error);

  return (
    <MainLayout session={session} memberships={memberships}>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-20 sm:px-7 sm:pt-8 lg:px-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">
              <Link href="/" className="hover:text-indigo-700">Workspace</Link>
              <span aria-hidden="true" className="px-1">/</span>
              Products
            </p>
            <h1 className="text-[25px] font-semibold tracking-[-0.04em] text-slate-900">Products & inventory</h1>
            <p className="mt-1.5 text-[13px] text-slate-500">Manage your catalog, stock levels, and product sales performance.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active products</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{activeProducts.length.toLocaleString()}</p>
          </div>
        </header>

        {updated && (
          <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {updated === "created" ? "Product created." :
              updated === "stock" ? "Inventory adjustment recorded." :
                updated === "image" ? "Product image uploaded." :
                  updated === "archived" ? "Product archived; order history retained." :
                    updated === "restored" ? "Product restored." :
                      updated === "category" ? "Category saved." : "Product saved."}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error === "stock" ? "The adjustment could not be applied. Check the product or ensure stock will not fall below zero." :
              error === "image" ? "Choose a valid JPEG, PNG, GIF, or WebP image smaller than 2 MB." :
                error === "category" ? "That category name already exists, or the category could not be updated." :
                  error === "duplicate" ? "A product with that name or SKU already exists, or its category is unavailable." :
                    error === "product" ? "That product could not be found." :
                      "Check the form values and try again."}
          </p>
        )}

        {lowStock.length > 0 && (
          <section aria-labelledby="low-stock-title" className="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
            <h2 id="low-stock-title" className="text-sm font-semibold text-amber-950">
              Low-stock alert · {lowStock.length} product{lowStock.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-xs text-amber-800">Stock is at or below the product&apos;s alert threshold.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {lowStock.map((product) => (
                <li key={product.id} className="rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-xs text-amber-950">
                  <span className="font-medium">{product.name}</span>
                  <span className="ml-2">{product.stockQuantity} left (alert at {product.lowStockThreshold})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {editor && (
          <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <details className="rounded-xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Add product</summary>
              <form action={createProductAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
                  Product name
                  <input required minLength={2} maxLength={120} name="name" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Category
                  <select required name="categoryId" defaultValue="" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="" disabled>Select category</option>
                    {catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  SKU
                  <input maxLength={64} name="sku" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Unit price (USD)
                  <input required type="number" min="0" max="9999999999.99" step="0.01" name="unitPrice" defaultValue="0.00" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Starting stock
                  <input required type="number" min="0" max="999999999" step="1" name="stockQuantity" defaultValue="0" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Low-stock threshold
                  <input required type="number" min="0" max="999999999" step="1" name="lowStockThreshold" defaultValue="5" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
                  Description
                  <textarea maxLength={1000} name="description" rows={2} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <button type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 sm:col-span-2">Create product</button>
              </form>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Manage categories</summary>
              <form action={createProductCategoryAction} className="mt-4 flex flex-wrap items-end gap-2">
                <label className="grid min-w-48 flex-1 gap-1 text-xs font-medium text-slate-700">
                  New category
                  <input required maxLength={80} name="name" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <button type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">Add category</button>
              </form>
              {catalog.categories.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100">
                  {catalog.categories.map((category) => (
                    <li key={category.id} className="py-2.5">
                      <form action={updateProductCategoryAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="categoryId" value={category.id} />
                        <label className="sr-only" htmlFor={`category-${category.id}`}>Category name</label>
                        <input id={`category-${category.id}`} required maxLength={80} name="name" defaultValue={category.name} className="h-9 min-w-40 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
                        <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Rename</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        )}

        <section aria-label="Product catalog" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Catalog & performance</h2>
            <p className="mt-1 text-xs text-slate-500">Sales figures include paid revenue less refunds; shipped orders deduct one unit from stock.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th scope="col" className="px-5 py-3.5">Product</th>
                  <th scope="col" className="px-4 py-3.5">Category</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Price</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Stock</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Paid orders</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Net revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeProducts.map((product) => (
                  <tr key={product.id} className="align-top hover:bg-slate-50/60">
                    <th scope="row" className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        {product.hasImage ? (
                          <Image src={`/products/${product.id}/image`} alt="" width={48} height={48} unoptimized className="size-12 rounded-lg border border-slate-200 object-cover" />
                        ) : (
                          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-400">Image</span>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                          {product.sku && <p className="mt-0.5 text-[11px] text-slate-500">SKU {product.sku}</p>}
                          {product.description && <p className="mt-1 max-w-xs text-[11px] font-normal text-slate-500">{product.description}</p>}
                          {editor && (
                            <div className="mt-2 flex flex-wrap gap-3">
                              <details>
                                <summary className="cursor-pointer text-[11px] font-medium text-indigo-700">Edit</summary>
                                <form action={updateProductAction} className="mt-2 grid w-64 gap-2 rounded-lg border border-slate-200 bg-white p-3">
                                  <input type="hidden" name="productId" value={product.id} />
                                  <input type="hidden" name="stockQuantity" value={product.stockQuantity} />
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">Name
                                    <input required minLength={2} maxLength={120} name="name" defaultValue={product.name} className="h-9 rounded border border-slate-200 px-2 text-xs" />
                                  </label>
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">Category
                                    <select name="categoryId" defaultValue={product.categoryId} className="h-9 rounded border border-slate-200 bg-white px-2 text-xs">
                                      {catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                  </label>
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">SKU
                                    <input maxLength={64} name="sku" defaultValue={product.sku} className="h-9 rounded border border-slate-200 px-2 text-xs" />
                                  </label>
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">Unit price
                                    <input required type="number" min="0" max="9999999999.99" step="0.01" name="unitPrice" defaultValue={product.unitPrice.toFixed(2)} className="h-9 rounded border border-slate-200 px-2 text-xs" />
                                  </label>
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">Low-stock threshold
                                    <input required type="number" min="0" max="999999999" step="1" name="lowStockThreshold" defaultValue={product.lowStockThreshold} className="h-9 rounded border border-slate-200 px-2 text-xs" />
                                  </label>
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">Description
                                    <textarea maxLength={1000} name="description" defaultValue={product.description} rows={2} className="rounded border border-slate-200 px-2 py-1 text-xs" />
                                  </label>
                                  <button type="submit" className="h-9 rounded bg-indigo-600 px-3 text-xs font-medium text-white">Save changes</button>
                                </form>
                              </details>
                              <details>
                                <summary className="cursor-pointer text-[11px] font-medium text-indigo-700">Upload image</summary>
                                <form action={`/products/${product.id}/image`} method="post" encType="multipart/form-data" className="mt-2 grid w-64 gap-2 rounded-lg border border-slate-200 bg-white p-3">
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                                    JPEG, PNG, GIF, or WebP · up to 2 MB
                                    <input required type="file" name="image" accept="image/jpeg,image/png,image/gif,image/webp" className="w-full text-xs" />
                                  </label>
                                  <button type="submit" className="h-9 rounded bg-indigo-600 px-3 text-xs font-medium text-white">Upload image</button>
                                </form>
                              </details>
                              <details>
                                <summary className="cursor-pointer text-[11px] font-medium text-indigo-700">Adjust stock</summary>
                                <form action={adjustInventoryAction} className="mt-2 grid w-64 gap-2 rounded-lg border border-slate-200 bg-white p-3">
                                  <input type="hidden" name="productId" value={product.id} />
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">Quantity change (+ or −)
                                    <input required type="number" min="-999999999" max="999999999" step="1" name="quantityDelta" placeholder="e.g. 12 or -2" className="h-9 rounded border border-slate-200 px-2 text-xs" />
                                  </label>
                                  <label className="grid gap-1 text-[11px] font-medium text-slate-600">Reason
                                    <input required maxLength={200} name="reason" className="h-9 rounded border border-slate-200 px-2 text-xs" />
                                  </label>
                                  <button type="submit" className="h-9 rounded bg-indigo-600 px-3 text-xs font-medium text-white">Record adjustment</button>
                                </form>
                              </details>
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                    <td className="px-4 py-4 text-xs text-slate-600">{product.category}</td>
                    <td className="px-4 py-4 text-right text-xs text-slate-700">{currency.format(product.unitPrice)}</td>
                    <td className={`px-4 py-4 text-right text-xs font-semibold ${product.stockQuantity <= product.lowStockThreshold ? "text-amber-700" : "text-slate-700"}`}>
                      {product.stockQuantity.toLocaleString()}
                      <span className="mt-1 block text-[10px] font-normal text-slate-400">alert at {product.lowStockThreshold}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-slate-700">{product.soldOrders.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-xs font-semibold text-slate-800">{currency.format(product.revenue)}</td>
                  </tr>
                ))}
                {activeProducts.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">No active products yet. Add a product to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {editor && archivedProducts.length > 0 && (
          <section aria-labelledby="archived-products-title" className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <h2 id="archived-products-title" className="text-sm font-semibold text-slate-900">Archived products</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {archivedProducts.map((product) => (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-700">{product.name} <span className="text-xs text-slate-400">· {product.category}</span></span>
                  <form action={restoreProductAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Restore product</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {editor && activeProducts.length > 0 && (
          <details className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Archive products</summary>
            <ul className="mt-3 divide-y divide-slate-100">
              {activeProducts.map((product) => (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-700">{product.name}</span>
                  <form action={archiveProductAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <button type="submit" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50">Archive</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}

        <section aria-labelledby="inventory-history-title" className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 id="inventory-history-title" className="text-sm font-semibold text-slate-900">Inventory movement history</h2>
            <p className="mt-1 text-xs text-slate-500">Latest 50 stock additions, adjustments, and order fulfillment movements.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th scope="col" className="px-5 py-3">Date (UTC)</th>
                  <th scope="col" className="px-4 py-3">Product</th>
                  <th scope="col" className="px-4 py-3">Movement</th>
                  <th scope="col" className="px-4 py-3 text-right">Change</th>
                  <th scope="col" className="px-5 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalog.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">{dateTime.format(new Date(movement.occurredAt))}</td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-800">{movement.productName}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{movement.movementType.replaceAll("_", " ")}</td>
                    <td className={`px-4 py-3.5 text-right text-xs font-semibold ${movement.quantityDelta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {movement.relatedOrderId ? (
                        <Link href={`/orders/${encodeURIComponent(movement.relatedOrderId)}`} className="text-indigo-700 hover:underline">{movement.reason} · {movement.relatedOrderId}</Link>
                      ) : movement.reason}
                    </td>
                  </tr>
                ))}
                {catalog.movements.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No inventory changes recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
