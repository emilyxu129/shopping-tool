import {
  getProducts,
  markLatestProductEventEmailed,
  refreshProduct,
  scrapeAndRefreshProduct,
} from "../../../../lib/db";
import { sendProductChangeEmail } from "../../../../lib/notifications";
import { scrapeProductUrl } from "../../../../lib/scraper";

export const runtime = "nodejs";

export async function POST() {
  const products = await getProducts();

  for (const product of products) {
    try {
      const scrapedProduct = await scrapeProductUrl(product.url, {
        trackedSize: product.trackedSize,
        variantSpecs: product.variantSpecs,
      });
      const refreshedProduct = await scrapeAndRefreshProduct(product.id, scrapedProduct);

      try {
        const notification = await sendProductChangeEmail(product, refreshedProduct);

        if (notification.sent) {
          await markLatestProductEventEmailed(product.id);
        }
      } catch (error) {
        console.warn("Could not send product change email:", error.message);
      }
    } catch {
      await refreshProduct(product.id);
    }
  }

  return Response.json({
    products: await getProducts(),
  });
}
