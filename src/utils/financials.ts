import { Product, Sale, SaleItem } from '../types';

/** Display split only: embedded work is already included in materialsCost. */
export const getRecipeCostSummary = (recipe: {
  materialsCost: number; embeddedLaborCost?: number; laborCost: number;
  fixedCost: number; otherCosts: number; batchYield: number; salePrice: number;
}) => {
  const units = Math.max(1, recipe.batchYield || 1);
  const embedded = recipe.embeddedLaborCost || 0;
  const materials = (recipe.materialsCost - embedded) / units;
  const labor = (recipe.laborCost + embedded) / units;
  const fixed = recipe.fixedCost / units;
  const materialsWithFixed = materials + fixed;
  const subtotalWithLabor = materialsWithFixed + labor;
  const other = recipe.otherCosts / units;
  const total = subtotalWithLabor + other;
  const profit = recipe.salePrice - total;
  const marginPercent = recipe.salePrice > 0 ? profit / recipe.salePrice * 100 : null;
  return { materials, fixed, materialsWithFixed, labor, subtotalWithLabor, other, total, profit, marginPercent };
};

export interface ProductFinancialSplit {
  businessCostPerUnit: number;
  laborRemunerationPerUnit: number;
}

export interface SaleFinancials {
  businessCost: number;
  laborRemuneration: number;
  ownerEarnings: number;
  commercialProfit: number;
  marginPercent: number;
}

export const getProductFinancialSplit = (product: Product): ProductFinancialSplit => {
  const yieldQty = Math.max(0.0001, product.batchYield || 1);
  const businessCostPerUnit =
    ((product.materialsCost || 0) - (product.embeddedLaborCost || 0) + (product.fixedCost || 0) + (product.otherCosts || 0)) / yieldQty;
  const laborRemunerationPerUnit = (product.laborCost || 0) / yieldQty;

  return {
    businessCostPerUnit,
    laborRemunerationPerUnit,
  };
};

export const getSaleItemFinancialSplit = (
  item: SaleItem,
  products: Product[]
): ProductFinancialSplit => {
  if (item.unitBusinessCost != null || item.unitLaborRemuneration != null) {
    return {
      businessCostPerUnit: item.unitBusinessCost ?? Math.max(0, item.unitCost - (item.unitLaborRemuneration || 0)),
      laborRemunerationPerUnit: item.unitLaborRemuneration ?? 0,
    };
  }

// Historical rows without a cost split keep their recorded total; current recipes never rewrite history.

  return {
    businessCostPerUnit: item.unitCost,
    laborRemunerationPerUnit: 0,
  };
};

export const getSaleFinancials = (sale: Sale, products: Product[]): SaleFinancials => {
  if (sale.commercialStatus === 'cancelled' || sale.commercialStatus === 'draft') return {businessCost:0,laborRemuneration:0,ownerEarnings:0,commercialProfit:0,marginPercent:0};
  const fallbackItem: SaleItem = {
    productId: sale.productId,
    productName: sale.productName,
    productImageUrl: sale.productImageUrl,
    quantity: sale.quantity,
    unitPrice: sale.unitPrice,
    unitCost: sale.unitCost,
    totalCost: sale.totalCost,
  };

  const items = sale.items?.length ? sale.items : [fallbackItem];

  const { businessCost, laborRemuneration } = items.reduce(
    (acc, item) => {
      const split = getSaleItemFinancialSplit(item, products);
      return {
        businessCost: acc.businessCost + split.businessCostPerUnit * item.quantity,
        laborRemuneration: acc.laborRemuneration + split.laborRemunerationPerUnit * item.quantity,
      };
    },
    { businessCost: 0, laborRemuneration: 0 }
  );

  const ownerEarnings = sale.totalRevenue - businessCost;
  const commercialProfit = ownerEarnings - laborRemuneration;
  const marginPercent = sale.totalRevenue > 0 ? (ownerEarnings / sale.totalRevenue) * 100 : 0;

  return {
    businessCost,
    laborRemuneration,
    ownerEarnings,
    commercialProfit,
    marginPercent,
  };
};

/** Shared recipe pricing for the editor, catalog and catalog recalculation. */
export const calculateRecipePricing = (
  materialsCost: number,
  laborCost: number,
  fixedCostPercent: number,
  otherCosts: number,
  batchYield: number,
  profitMarginPercent: number,
  chosenPrice?: number,
  embeddedLaborCost = 0
) => {
  const yieldQty = Math.max(1, batchYield || 1);
  const fixedCost = (materialsCost + laborCost) * ((fixedCostPercent || 0) / 100);
  const totalCost = materialsCost + laborCost + fixedCost + otherCosts;
  const unitCostFromBatch = totalCost / yieldQty;
  const laborUnitCost = (laborCost + embeddedLaborCost) / yieldQty;
  const businessUnitCost = (materialsCost - embeddedLaborCost + fixedCost + otherCosts) / yieldQty;
  const margin = Math.min(Math.max(profitMarginPercent || 0, 0), 95) / 100;
  const suggestedPrice = Math.round(
    ((materialsCost - embeddedLaborCost) / yieldQty / (1 - margin) + laborUnitCost + (fixedCost + otherCosts) / yieldQty) * 100
  ) / 100;
  const currentActualPrice = chosenPrice != null && Number.isFinite(chosenPrice) && chosenPrice >= 0
    ? chosenPrice : suggestedPrice;
  const netProfit = currentActualPrice - businessUnitCost;
  const commercialProfit = netProfit - laborUnitCost;
  const calculatedMarginPercent = currentActualPrice > 0 ? netProfit / currentActualPrice * 100 : 0;
  return { fixedCost, totalCost, unitCostFromBatch, laborUnitCost, businessUnitCost,
    suggestedPrice, currentActualPrice, netProfit, commercialProfit, calculatedMarginPercent };
};

export const getRecipePricing = (product: Product) => calculateRecipePricing(
  product.materialsCost || 0,
  ((product.productionTimeMinutes || 0) / 60) * (product.hourlyRate || 0),
  product.fixedCostPercent || 0,
  product.otherCosts || 0,
  product.batchYield || 1,
  product.profitMarginPercent || 0,
  product.actualPrice, product.embeddedLaborCost || 0
);
