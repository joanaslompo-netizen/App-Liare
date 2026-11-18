import type { Material, Product, ProductionProject, ProjectMaterialQuote, ProjectProductLine, ProjectRecipeItem, UnitOfMeasure } from '../types';
import { getRecipePricing } from './financials';
import { calculateUnitCost, getUnitConversionMultiplier, normalizeSearchText } from './formatters';

export const isRecipeSimulation = (line: ProjectProductLine) =>
  line.source === 'custom' && (!!line.isSimulation || !!line.customRecipeItems?.some(item => item.materialQuote));

export const getProjectRecipeSalePrice = (line: Pick<ProjectProductLine, 'targetSalePrice'>, catalogSalePrice?: number) =>
  line.targetSalePrice != null && Number.isFinite(line.targetSalePrice) && line.targetSalePrice > 0
    ? line.targetSalePrice : catalogSalePrice;

export function duplicateProjectRecipe(line: ProjectProductLine, product: Product | null, lines: ProjectProductLine[]): ProjectProductLine {
  const originalName = product?.name || line.name;
  const names = new Set(lines.map(value => value.name));
  let name = `${originalName} (cópia)`;
  for (let number = 2; names.has(name); number++) name = `${originalName} (cópia ${number})`;

  const sourceItems: ProjectRecipeItem[] = product?.items || line.customRecipeItems || [];
  const catalogSalePrice = product ? getRecipePricing(product).currentActualPrice : undefined;
  return {
    id: crypto.randomUUID(),
    source: 'custom',
    name,
    quantity: line.quantity,
    producedQuantity: 0,
    batchYield: product?.batchYield || line.batchYield,
    targetSalePrice: getProjectRecipeSalePrice(line, catalogSalePrice),
    notes: product?.notes ?? line.notes,
    isSimulation: true,
    recipePricing: product ? {
      productionTimeMinutes: product.productionTimeMinutes,
      hourlyRate: product.hourlyRate,
      fixedCostPercent: product.fixedCostPercent,
      otherCosts: product.otherCosts,
    } : line.recipePricing,
    customRecipeItems: sourceItems.map(item => {
      const id = crypto.randomUUID();
      if (item.materialQuote) return createQuotedRecipeItem(item.name, item.quantity, item.materialQuote, id);
      return { ...item, id, categorySelections: item.categorySelections && { ...item.categorySelections } };
    }),
  };
}

export const isCompatibleQuoteUnit = (packageUnit: UnitOfMeasure, unit: UnitOfMeasure) =>
  packageUnit === unit || getUnitConversionMultiplier(packageUnit, unit) !== 1;

export function createQuotedRecipeItem(
  name: string,
  quantity: number,
  quote: ProjectMaterialQuote,
  id: string = crypto.randomUUID(),
): ProjectRecipeItem {
  if (!name.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Informe o nome e a quantidade usada na receita.');
  }
  if (!Number.isFinite(quote.packageQuantity) || quote.packageQuantity <= 0
    || !Number.isFinite(quote.packagePrice) || quote.packagePrice < 0
    || !isCompatibleQuoteUnit(quote.packageUnit, quote.unit)) {
    throw new Error('Informe uma quantidade, uma unidade compatível e um preço para a embalagem.');
  }

  const unitCost = calculateUnitCost(quote.packagePrice, quote.packageQuantity, quote.packageUnit, quote.unit);
  const totalCost = unitCost * quantity;
  if (!Number.isFinite(totalCost)) throw new Error('Confira o custo e a quantidade do material.');

  return {
    id,
    type: 'material',
    targetId: `mat_project_${id}`,
    name: name.trim(),
    unit: quote.unit,
    quantity,
    unitCost,
    totalCost,
    materialQuote: { ...quote, category: quote.category.trim() || 'Geral' },
  };
}

export function approveProjectRecipe(project: ProductionProject, lineId: string, materials: Material[]) {
  const line = project.lines.find(item => item.id === lineId);
  if (!line || line.source !== 'custom') throw new Error('Receita do projeto não encontrada.');
  if (!isRecipeSimulation(line)) return { project, newMaterials: [] as Material[] };

  const newMaterials: Material[] = [];
  const knownMaterials = [...materials];
  const items = (line.customRecipeItems || []).map(item => {
    const { materialQuote, ...ingredient } = item;
    if (!materialQuote) return item;

    const validated = createQuotedRecipeItem(item.name, item.quantity, materialQuote, item.id);
    let material = knownMaterials.find(value => value.id === validated.targetId);
    material ??= knownMaterials.find(value =>
      !value.isPaused && !value.isMadeInAtelier && value.usageType !== 'durable'
      && normalizeSearchText(value.name) === normalizeSearchText(validated.name)
      && normalizeSearchText(value.category) === normalizeSearchText(materialQuote.category)
      && value.unit === materialQuote.unit && value.packageUnit === materialQuote.packageUnit
      && value.packageQuantity === materialQuote.packageQuantity && value.packagePrice === materialQuote.packagePrice
      && value.unitCost === validated.unitCost
    );
    if (!material) {
      material = {
        id: validated.targetId,
        name: validated.name,
        ...validated.materialQuote!,
        materialType: 'internal',
        usageType: 'consumable',
        unitCost: validated.unitCost,
        currentStock: 0,
        minStock: 0,
        createdAt: project.updatedAt,
        updatedAt: project.updatedAt,
      };
      knownMaterials.push(material);
      newMaterials.push(material);
    }
    return {
      ...ingredient,
      targetId: material.id,
      name: material.name,
      unit: material.unit,
      unitCost: material.unitCost,
      totalCost: material.unitCost * ingredient.quantity,
    };
  });

  return {
    project: {
      ...project,
      lines: project.lines.map(value => value.id === lineId
        ? { ...value, customRecipeItems: items, isSimulation: undefined, approvedAt: project.updatedAt }
        : value),
    },
    newMaterials,
  };
}
