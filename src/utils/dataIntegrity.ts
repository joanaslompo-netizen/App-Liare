import type { Material, Product, Sale, RecipeItem } from '../types';

export interface IntegrityIssue { code: string; entityId: string; message: string; }
interface WorkspaceData { materials?: Material[]; products?: Product[]; sales?: Sale[]; }

/** Consulta apenas: nunca altera, recalcula, migra ou salva os registros recebidos. */
export function inspectDataIntegrity(data: WorkspaceData): IntegrityIssue[] {
  const materials = Array.isArray(data.materials) ? data.materials : [];
  const products = Array.isArray(data.products) ? data.products : [];
  const sales = Array.isArray(data.sales) ? data.sales : [];
  const materialIds = new Set(materials.map((item) => item.id));
  const productIds = new Set(products.map((item) => item.id));
  const issues: IntegrityIssue[] = [];
  const add = (code: string, entityId: string, message: string) => issues.push({ code, entityId, message });
  const number = (id: string, label: string, field: string, value: unknown) => {
    if (value === undefined) return; // Campos antigos opcionais permanecem compatíveis.
    if (typeof value !== 'number' || !Number.isFinite(value)) add('invalid-number', id, `${label}: ${field} inválido.`);
    else if (value < 0) add('negative-number', id, `${label}: ${field} negativo; confira se é intencional.`);
  };
  const recipe = (id: string, label: string, items: RecipeItem[] | undefined) => {
    for (const item of Array.isArray(items) ? items : []) {
      if (item.selectionMode !== 'category') {
        const ids = item.type === 'product' ? productIds : materialIds;
        if (!ids.has(item.targetId)) add('missing-ingredient', id, `${label}: componente ausente (${item.name || item.targetId}).`);
      }
      number(id, label, 'quantidade do componente', item.quantity);
      number(id, label, 'custo do componente', item.unitCost);
    }
  };
  for (const material of materials) {
    number(material.id, material.name, 'estoque', material.currentStock);
    number(material.id, material.name, 'custo unitário', material.unitCost);
    number(material.id, material.name, 'estoque mínimo', material.minStock);
    if (material.isMadeInAtelier) recipe(material.id, material.name, material.recipeItems);
  }
  for (const product of products) {
    if (!Array.isArray(product.items) || !product.items.length) add('empty-recipe', product.id, `${product.name}: sem composição; pode ser um cadastro em preparação.`);
    if (product.parentRecipeId && !productIds.has(product.parentRecipeId)) add('missing-base', product.id, `${product.name}: fórmula base não encontrada.`);
    recipe(product.id, product.name, product.items);
    number(product.id, product.name, 'estoque', product.currentStock);
    number(product.id, product.name, 'custo total', product.totalCost);
    number(product.id, product.name, 'preço de venda', product.actualPrice);
  }
  for (const sale of sales) {
    const label = `Pedido ${sale.orderNumber || sale.id}`;
    const items = Array.isArray(sale.items) && sale.items.length ? sale.items : [{ productId: sale.productId, productName: sale.productName, isCustom: false, quantity: sale.quantity }];
    for (const item of items) {
      // Personalizados ainda sem receita formal e materiais para venda direta são válidos.
      if (!item.isCustom && !productIds.has(item.productId) && !materialIds.has(item.productId)) add('missing-order-product', sale.id, `${label}: item não encontrado (${item.productName || item.productId}). O histórico pode ter sido preservado após exclusão.`);
      number(sale.id, label, 'quantidade', item.quantity);
    }
    number(sale.id, label, 'valor do pedido', sale.totalRevenue);
    number(sale.id, label, 'valor pago', sale.amountPaid);
  }
  return issues;
}
