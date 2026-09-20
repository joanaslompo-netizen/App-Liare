export type UnitOfMeasure = 
  | 'un'      // Unidade
  | 'm'       // Metro
  | 'cm'      // Centímetro
  | 'mm'      // Milímetro
  | 'kg'      // Quilograma
  | 'g'       // Grama
  | 'l'       // Litro
  | 'ml'      // Mililitro
  | 'folha'   // Folha
  | 'rolo'    // Rolo
  | 'par'     // Par
  | 'pct';    // Pacote

export interface UnitDefinition {
  value: UnitOfMeasure;
  label: string;
  symbol: string;
  category: 'length' | 'weight' | 'volume' | 'count';
  baseRatio: number; // Ratio relative to base unit of category (m, kg, l, un)
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  createdAt: string;
}

export type MaterialType = 'internal' | 'for_sale'; // 'internal' = insumo interno/etiqueta/aviamento/embalagem, 'for_sale' = produto pronto para venda direta

export interface Material {
  id: string;
  name: string;
  category: string;
  materialType?: MaterialType; // Tipo de material: insumo interno vs venda direta
  unit: UnitOfMeasure; // Base unit used in recipes (e.g. cm, g, un)
  packageQuantity: number; // How much came in the package (e.g. 50 metros)
  packageUnit: UnitOfMeasure; // Unit of package (e.g. m)
  packagePrice: number; // Price paid for package in R$
  unitCost: number; // Cost per base unit (R$ / unit)
  currentStock: number; // Current quantity in stock (in base unit)
  minStock: number; // Minimum stock threshold for alert
  supplierId?: string;
  supplierName?: string;
  imageUrl?: string;
  notes?: string;
  /** True when this material is built from an atelier recipe instead of being purchased ready-made. */
  isMadeInAtelier?: boolean;
  /** Virtual recipes are prepared on demand and therefore do not keep their own stock. */
  isVirtualRecipe?: boolean;
  /** Recipe/BOM used when isMadeInAtelier is true. */
  recipeItems?: RecipeItem[];
  /** Quantity produced by one recipe batch, in the material base unit. */
  batchYield?: number;
  /** Estimated total cost of one recipe batch. */
  recipeTotalCost?: number;
  /** Estimated cost per base unit produced by the recipe. */
  unitCostFromBatch?: number;
  createdAt: string;
  updatedAt: string;
}

export type RecipeItemType = 'material' | 'product';

export interface RecipeItem {
  id: string; // unique item row id
  type: RecipeItemType;
  targetId: string; // ID of Material/Product, or a synthetic category key for category-choice ingredients
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  /** Fixed item by default; category items are chosen only when the final production is launched. */
  selectionMode?: 'fixed' | 'category';
  /** Material category used when selectionMode is "category" (ex: "Essências"). */
  targetCategory?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  isIntermediate: boolean; // True if this item is a sub-component (like "Etiqueta", "Tag Kraft", "Laço")
  items: RecipeItem[];
  materialsCost: number; // Sum of material + sub-product items
  productionTimeMinutes: number;
  hourlyRate: number; // R$/hour for artisan pro-labore
  laborCost: number; // (productionTimeMinutes / 60) * hourlyRate
  fixedCostPercent: number; // % of indirect atelier costs (energy, tools)
  fixedCost: number;
  otherCosts: number; // packaging, shipping boxes, gifts
  totalCost: number;
  profitMarginPercent: number; // Desired profit margin (e.g. 50%)
  suggestedPrice: number; // Recommended retail price
  actualPrice: number; // Actual selling price chosen
  calculatedMarginPercent: number; // Actual margin achieved
  netProfit: number; // actualPrice - totalCost
  batchYield: number; // Number of units produced with this recipe (defaults to 1, or e.g. 50 tags)
  unitCostFromBatch: number; // totalCost / batchYield
  currentStock?: number; // Estoque atual disponível (peças/unidades prontas)
  minStock?: number; // Estoque mínimo de segurança para alerta
  standardStock?: number; // Estoque padrão (meta ideal de peças em pronta-entrega)
  notes?: string; // Notas ou observações da receita/peça
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: UnitOfMeasure;
  packagePrice: number;
  totalPrice: number;
}

export interface Purchase {
  id: string;
  date: string; // YYYY-MM-DD
  supplierId?: string;
  supplierName: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  shippingCost: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  birthdate?: string; // YYYY-MM-DD
  email?: string;
  notes?: string;
  createdAt: string;
}

export type OrderType = 'pronta_entrega' | 'encomenda';
export type DeliveryStatus = 'entregue' | 'pendente_entrega';
export type PaymentStatus = 'pago' | 'pendente_pagamento';

export interface SaleItem {
  id?: string;
  productId: string;
  productName: string;
  productImageUrl?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalRevenue?: number;
  subtotal?: number;
  totalCost: number;
  totalProfit?: number;
  /** Item criado somente para este pedido; não entra no catálogo de produtos. */
  isCustom?: boolean;
  /** Composição opcional do item personalizado, preenchida quando os insumos forem conhecidos. */
  customRecipeItems?: RecipeItem[];
}

export interface Sale {
  id: string;
  date: string; // YYYY-MM-DD (data do pedido/venda)
  items?: SaleItem[]; // Lista de itens múltiplos do pedido
  productId: string; // Mantido para compatibilidade (primeiro item ou item principal)
  productName: string; // Resumo ou nome do produto principal
  productImageUrl?: string;
  quantity: number; // Total de peças somadas
  unitPrice: number;
  unitCost: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  marginPercent: number;
  customerId?: string; // ID do cliente cadastrado
  customerName?: string;
  customerContact?: string; // Telefone/WhatsApp do cliente
  channel?: string; // Elo7, Instagram, Feira, WhatsApp, etc.
  paymentMethod?: string; // 'offline', 'site' ou categoria personalizada
  notes?: string;

  // Novos campos para flexibilidade de Pedidos & Pronta Entrega
  orderType?: OrderType; // 'pronta_entrega' ou 'encomenda'
  deliveryStatus?: DeliveryStatus; // 'entregue' ou 'pendente_entrega'
  deliveryScheduledDate?: string; // YYYY-MM-DD (data prevista para entrega)
  deliveryActualDate?: string; // YYYY-MM-DD (quando foi entregue)
  paymentStatus?: PaymentStatus; // 'pago' ou 'pendente_pagamento'
  paymentScheduledDate?: string; // YYYY-MM-DD (data prevista para receber)
  paymentActualDate?: string; // YYYY-MM-DD (quando foi pago)

  createdAt: string;
}

export interface ProductionIngredientDeduction {
  id: string; // ID do item na receita
  targetId: string; // ID do Material ou Product
  type: RecipeItemType;
  name: string;
  unit: string;
  quantityPerBatch: number; // Qtd necessária por lote
  quantityTotal: number; // Qtd total consumida nesta produção
  unitCost: number; // Custo unitário do insumo
  totalCost: number; // Custo total do insumo consumido
  stockBefore: number; // Estoque antes da produção
  stockAfter: number; // Estoque após a baixa da produção
}

export interface Production {
  id: string;
  date: string; // YYYY-MM-DD
  productId: string;
  productName: string;
  productCategory?: string;
  productImageUrl?: string;
  isIntermediate?: boolean; // Peça final vs Componente/Sub-produto
  batchYield: number; // Rendimento por lote da receita (ex: 1 un, 10 un)
  batchCount: number; // Quantidade de lotes/bateladas produzidas
  quantityProduced: number; // Total de peças/unidades obtidas (batchCount * batchYield)
  costPerUnit: number; // Custo por peça da receita
  totalCost: number; // Custo total da produção realizada
  deductedItems: ProductionIngredientDeduction[]; // Insumos e sub-produtos consumidos
  notes?: string;
  createdAt: string;
}

export interface AtelierSettings {
  atelierName: string;
  artisanName: string;
  defaultHourlyRate: number; // R$/h
  defaultFixedCostPercent: number; // %
  defaultProfitMargin: number; // %
  paymentMethods?: string[]; // Lista de formas/categorias de pagamento ('offline', 'site', etc.)
}

export type NavTab = 
  | 'home' 
  | 'materials' 
  | 'products' 
  | 'productions'
  | 'purchases' 
  | 'sales' 
  | 'reports' 
  | 'suppliers'
  | 'customers';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'high' | 'normal' | 'low';
  dueDate?: string;
  createdAt: string;
}
