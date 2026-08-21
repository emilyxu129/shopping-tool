import {
  getProduct,
  markLatestProductEventEmailed,
  refreshProduct,
  scrapeAndRefreshProduct,
} from "../../../../../lib/db";
import { sendProductChangeEmail } from "../../../../../lib/notifications";
import { scrapeProductUrl } from "../../../../../lib/scraper";

export const runtime = "nodejs";

export async function POST(_request, { params }) {
  const { id } = await params;
  const existingProduct = await getProduct(id);

  if (!existingProduct) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  let product;

  try {
    const scrapedProduct = await scrapeProductUrl(existingProduct.url, {
      trackedSize: existingProduct.trackedSize,
      variantSpecs: existingProduct.variantSpecs,
    });
    product = await scrapeAndRefreshProduct(id, scrapedProduct);

    try {
      const notification = await sendProductChangeEmail(existingProduct, product);

      if (notification.sent) {
        await markLatestProductEventEmailed(id);
      }
    } catch (error) {
      console.warn("Could not send product change email:", error.message);
    }
  } catch {
    product = await refreshProduct(id);
  }

  if (!product) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  return Response.json({ product });
}
