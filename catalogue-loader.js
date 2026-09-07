/* VK Nutrition — live catalogue loader.
   Replaces the old <script src="./catalogue-data.js"> approach.
   Fetches products from Supabase (populated by the admin panel) and
   exposes them on window.VK_CATALOGUE in the exact same shape script.js
   already expects, so the rest of script.js needs ZERO changes.

   If the fetch fails (offline, Supabase down, etc.) it falls back to the
   bundled catalogue-data.js snapshot so the storefront never shows a blank
   page. Include catalogue-data.js as a fallback BEFORE this script, or the
   fallback constant below will simply be empty. */

(function () {
  const SUPABASE_URL = "https://owpgbkrnimhwvgqntggq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_yVu_tEIx690wZny03SmjBg_yNQX8toM";

  // Keep whatever catalogue-data.js already set (if it's included as a
  // fallback) so we can use it if the live fetch fails.
  const fallbackCatalogue = Array.isArray(window.VK_CATALOGUE) ? window.VK_CATALOGUE : [];

  function mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.discount_price ?? row.price,
      originalPrice: row.discount_price ? row.price : undefined,
      pack: row.pack || "",
      spec: row.description || "",
      highlights: row.highlights || [],
      image: (row.images && row.images[0]) || "",
      images: row.images || [],
      stock: row.stock,
      status: row.status,
    };
  }

  async function loadLiveCatalogue() {
    const url = `${SUPABASE_URL}/rest/v1/products?select=*&status=neq.hidden&order=sort_order.asc,name.asc`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase products fetch failed: ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("No products returned");
    return rows.filter((r) => r.status !== "out_of_stock" || true).map(mapRow);
    // (out-of-stock items are still shown, marked unavailable, so customers
    // can see them — change the filter above if you'd rather hide them)
  }

  // Fire this as early as possible; script.js reads window.VK_CATALOGUE
  // synchronously today, so we dispatch a "vk:catalogue-ready" event and
  // script.js's product rendering should listen for it (see integration
  // note in the README) OR you can keep this fully synchronous by rendering
  // the grid yourself once the promise resolves — see loadAndRender() below.
  window.VK_CATALOGUE_READY = loadLiveCatalogue()
    .then((products) => {
      window.VK_CATALOGUE = products;
      document.dispatchEvent(new CustomEvent("vk:catalogue-ready", { detail: { source: "live" } }));
      return products;
    })
    .catch((err) => {
      console.warn("[VK] Live catalogue fetch failed, using bundled fallback.", err);
      window.VK_CATALOGUE = fallbackCatalogue;
      document.dispatchEvent(new CustomEvent("vk:catalogue-ready", { detail: { source: "fallback" } }));
      return fallbackCatalogue;
    });
})();
