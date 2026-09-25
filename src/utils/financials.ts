import { Product, Sale, SaleItem } from '../types';

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
    ((product.materialsCost || 0) + (product.fixedCost || 0) + (product.otherCosts || 0)) / yieldQty;
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

  const productId = item.isCustom ? item.customProductId || item.productId : item.productId;
  const product = products.find((p) => p.id === productId);
  if (product) return getProductFinancialSplit(product);

  return {
    businessCostPerUnit: item.unitCost,
    laborRemunerationPerUnit: 0,
  };
};

export const getSaleFinancials = (sale: Sale, products: Product[]): SaleFinancials => {
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
