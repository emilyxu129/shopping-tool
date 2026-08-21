import { deleteProduct, updateProductTrackedSize } from "../../../../lib/db";

export const runtime = "nodejs";

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const deleted = await deleteProduct(id);

  if (!deleted) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  return Response.json({ deleted: true });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const trackedSize = body.trackedSize ?? "";
  const product = await updateProductTrackedSize(id, trackedSize, body.variantSpecs);

  if (!product) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  return Response.json({ product });
}
