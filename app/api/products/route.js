import { createProduct, getProducts, scrapeAndRefreshProduct } from "../../../lib/db";
import { scrapeProductUrl } from "../../../lib/scraper";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    products: await getProducts(),
  });
}

export async function POST(request) {
  const body = await request.json();
  const url = body.url?.trim();
  const trackedSize = body.trackedSize?.trim() || "";
  const variantSpecs = body.variantSpecs?.trim() || "";

  if (!url) {
    return Response.json({ error: "Product URL is required." }, { status: 400 });
  }

  try {
    const savedProduct = await createProduct(url, trackedSize, variantSpecs);
    let product = savedProduct;

    try {
      const scrapedProduct = await scrapeProductUrl(savedProduct.url, {
        trackedSize: savedProduct.trackedSize,
        variantSpecs: savedProduct.variantSpecs,
      });
      product = await scrapeAndRefreshProduct(savedProduct.id, scrapedProduct);
    } catch {
      // Saving the URL is still useful even when the first scrape fails.
    }

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    if (error.code === "ERR_SQLITE_CONSTRAINT_UNIQUE" || error.code === "23505") {
      return Response.json(
        { error: "This product URL is already tracked." },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Could not save this product." },
      { status: 500 },
    );
  }
}
