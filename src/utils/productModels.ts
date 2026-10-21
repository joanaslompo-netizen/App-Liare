import type { Product } from "../types";

export interface ProductModel {
  id: string;
  name: string;
  products: Product[];
  isFamily: boolean;
}

/** Only explicit families and mother links define a model. Names are never guessed. */
export function getProductModels(
  products: Product[],
  mode: "sale" | "production" = "sale",
): ProductModel[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rootOf = (product: Product) => {
    const seen = new Set([product.id]);
    while (
      product.parentRecipeId &&
      byId.has(product.parentRecipeId) &&
      !seen.has(product.parentRecipeId)
    ) {
      product = byId.get(product.parentRecipeId)!;
      seen.add(product.id);
    }
    return product;
  };
  const mothers = new Set(
    products.filter((p) => p.isFamilyMother).map((p) => p.id),
  );
  products.forEach((p) => {
    if (p.parentRecipeId && byId.has(p.parentRecipeId))
      mothers.add(rootOf(p).id);
  });
  const familyMothers = new Map<string, Product[]>();
  products
    .filter((p) => mothers.has(p.id) && p.productFamily?.trim())
    .forEach((p) => {
      const family = p.productFamily!.trim();
      familyMothers.set(family, [...(familyMothers.get(family) || []), p]);
    });
  const groups = new Map<string, ProductModel>();
  for (const product of products) {
    if (product.isCustomRecipe || (mode === "sale" && product.isIntermediate))
      continue;
    let root = rootOf(product);
    const family = root.productFamily?.trim() || product.productFamily?.trim();
    if (
      !mothers.has(root.id) &&
      family &&
      familyMothers.get(family)?.length === 1
    )
      root = familyMothers.get(family)![0];
    const linked = mothers.has(root.id);
    const id = linked
      ? `mother:${root.id}`
      : family
        ? `family:${family}`
        : `product:${product.id}`;
    const group = groups.get(id) || {
      id,
      name: linked
        ? root.productFamily?.trim() || root.customName || root.name
        : family || product.name,
      products: [],
      isFamily: linked || !!family,
    };
    group.products.push(product);
    groups.set(id, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      products: group.products.sort(
        (a, b) =>
          Number(!!a.isPaused) - Number(!!b.isPaused) ||
          (a.fragrance || a.name).localeCompare(
            b.fragrance || b.name,
            "pt-BR",
            { sensitivity: "base" },
          ),
      ),
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
}

export function getVariantLabel(product: Product, model: ProductModel): string {
  const aroma = product.fragrance?.trim();
  if (!aroma)
    return model.products.length > 1
      ? product.customName || "Receita base"
      : product.name;
  const duplicates =
    model.products.filter((p) => p.fragrance?.trim() === aroma).length > 1;
  return duplicates
    ? `${aroma} · ${product.customName || product.name}`
    : aroma;
}
