import type { AutomaticManufacture, Material, Product, Production, RecipeItem, StockMovement } from '../types';
import { expandVirtualRecipeItems, type ExpandedRecipeNode } from './virtualMaterials';

const rounded = (value: number) => Number(value.toFixed(8));

/** Preview only; never stored on a production or used as an additional deduction. */
export interface ConsumptionForecastNode {
  item: RecipeItem;
  quantityTotal: number;
  stockQuantity: number;
  manufactureQuantity: number;
  isVirtualRecipe: boolean;
  stockAfter?: number;
  children: ConsumptionForecastNode[];
}

/** A pure stock plan: use ready stock first and manufacture only the deficit.
 * The new component is immediately consumed, so only its existing stock and
 * the real ingredients appear in net deductions. This also makes undo exact.
 */
export function planAutomaticConsumption(items: RecipeItem[], materials: Material[], products: Product[], factor = 1, selections: Record<string, string> = {}, protectedStock = new Map<string, number>()) {
  const balances = new Map<string, number>();
  for (const material of materials) balances.set(`material:${material.id}`, Math.max(0, material.currentStock || 0));
  for (const product of products) balances.set(`product:${product.id}`, Math.max(0, (product.currentStock || 0) - (protectedStock.get(product.id) || 0)));
  const initial = new Map(balances);
  const used = new Map<string, RecipeItem>();
  const automaticManufacturing: AutomaticManufacture[] = [];
  const expanded = expandVirtualRecipeItems(items, materials, products, selections);
  const errors = [...expanded.errors];
  let preparationCost = expanded.preparationCost * factor;
  const add = (item: RecipeItem, quantity: number) => {
    if (quantity <= 0) return;
    const key = `${item.type}:${item.targetId}`, previous = used.get(key);
    used.set(key, { ...item, quantity: rounded((previous?.quantity || 0) + quantity) });
    balances.set(key, rounded((balances.get(key) || 0) - quantity));
  };
  const consume = (item: RecipeItem, quantity: number, ancestors: string[]): ConsumptionForecastNode | undefined => {
    if (!Number.isFinite(quantity) || quantity < 0) { errors.push(`Quantidade inválida em "${item.name}".`); return; }
    if (quantity <= 0.00000001) return;
    const key = `${item.type}:${item.targetId}`;
    const material = item.type === 'material' ? materials.find(value => value.id === item.targetId) : undefined;
    const product = item.type === 'product' ? products.find(value => value.id === item.targetId) : undefined;
    if (material?.usageType === 'durable') return;
    const available = Math.max(0, balances.get(key) || 0);
    const node: ConsumptionForecastNode = { item, quantityTotal: rounded(quantity), stockQuantity: rounded(Math.min(available, quantity)),
      manufactureQuantity: 0, isVirtualRecipe: false, children: [] };
    if (available + 0.00000001 >= quantity) { add(item, quantity); return { ...node, stockAfter: balances.get(key) }; }
    // A made-to-order item may intentionally have no material composition yet.
    const canMake = material ? material.isMadeInAtelier : !!product && (!!product.items?.length || product.isCustomRecipe === true);
    if (!canMake) { add(item, quantity); return { ...node, stockAfter: balances.get(key) }; }
    if (ancestors.includes(key)) { errors.push(`A receita de "${item.name}" contém uma referência circular.`); return; }
    const yieldQty = material?.batchYield ?? product?.batchYield;
    if (!Number.isFinite(yieldQty) || yieldQty! <= 0 || (material && !material.recipeItems?.length)) { errors.push(`Confira os ingredientes e o rendimento de "${item.name}".`); return; }
    add(item, available);
    const missing = rounded(quantity - available);
    let recipe;
    let scale = 1;
    if (material) {
      // Reuse the existing virtual-recipe resolver, including fixed selections,
      // to prepare the missing amount of a physical made material.
      recipe = expandVirtualRecipeItems([{ ...item, quantity: missing }], materials.map(value => value.id === material.id ? { ...value, isVirtualRecipe: true } : value), products, selections);
    } else {
      scale = missing / yieldQty!;
      recipe = expandVirtualRecipeItems(product!.items, materials, products, selections);
      preparationCost += Math.max(0, product!.totalCost - product!.materialsCost) * scale;
    }
    errors.push(...recipe.errors);
    preparationCost += recipe.preparationCost * scale;
    node.manufactureQuantity = missing;
    // A physical material's temporary virtual root represents this same item.
    // Keep only its children below the physical item's full required quantity.
    node.children = consumeTree(material ? recipe.tree.flatMap(root => root.children) : recipe.tree, scale, [...ancestors, key]);
    automaticManufacturing.push({ type: item.type, targetId: item.targetId, name: item.name, quantity: missing, unit: item.unit });
    return node;
  };
  function consumeTree(nodes: ExpandedRecipeNode[], scale: number, ancestors: string[]): ConsumptionForecastNode[] {
    return nodes.flatMap(node => {
      if (node.isVirtualRecipe) return [{ item: node.item, quantityTotal: rounded(node.item.quantity * scale),
        stockQuantity: 0, manufactureQuantity: 0, isVirtualRecipe: true, children: consumeTree(node.children, scale, ancestors) }];
      const consumed = consume(node.item, node.item.quantity * scale, ancestors);
      return consumed ? [consumed] : [];
    });
  }
  const forecast = consumeTree(expanded.tree, factor, []);
  const deductions = [...used.entries()].map(([key, item]) => ({ ...item, quantityPerBatch: factor > 0 ? item.quantity / factor : 0, quantityTotal: item.quantity, totalCost: item.unitCost * item.quantity, stockBefore: initial.get(key) || 0, stockAfter: rounded((initial.get(key) || 0) - item.quantity) }));
  return { deductions, automaticManufacturing, forecast, errors: [...new Set(errors)], preparationCost, requirements: expanded.requirements, hasStockShortage: deductions.some(item => item.stockAfter < -0.0001) };
}

/** Never double-consume ingredients of a component already being made by stages. */
export function validateAutomaticManufacturing(events: AutomaticManufacture[] = [], productions: Production[] = []) {
  const active = new Set(productions.filter(production => production.status === 'in_progress').map(production => production.productId));
  const duplicate = events.find(event => event.type === 'product' && active.has(event.targetId));
  if (duplicate) throw new Error(`Há uma produção de "${duplicate.name}" em andamento. Conclua essa produção para evitar descontar os materiais duas vezes.`);
}

export function automaticStockMovements(events: AutomaticManufacture[] = [], id: string, date: string, referenceId = id): StockMovement[] {
  return events.flatMap((event, index) => [
    { id: `${id}_auto_${index}_made`, date, targetId: event.targetId, type: event.type, quantity: event.quantity, reason: 'Produção automática', referenceId },
    { id: `${id}_auto_${index}_used`, date, targetId: event.targetId, type: event.type, quantity: -event.quantity, reason: 'Consumo da produção automática', referenceId },
  ]);
}
