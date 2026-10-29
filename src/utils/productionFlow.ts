import type { Material, Product, Production, ProductionIngredientDeduction, StockMovement } from '../types';
import { canonicalJSON } from '../services/workspaceRecordStore';
import { automaticStockMovements, validateAutomaticManufacturing, type ConsumptionForecastNode } from './automaticManufacturing';
import { getProductFinancialSplit } from './financials';
import { localDateString } from './localDate';
import { resolveProductionRecipe, orderedProductionStages, liveProductionStageKey, stageAvailable, productionTarget, productionRecipeFingerprint } from "./productionRecipe";
import { getProductionPlan } from './productionPlanning';

const round = (value: number) => Number(value.toFixed(4));
export { productionTarget } from "./productionRecipe";
export const productionRemaining = (production: Production) => production.status === 'in_progress'
  ? Math.max(0, round(productionTarget(production) - production.quantityProduced)) : 0;
const sortedStages = orderedProductionStages;
const oldestFirst = (a: Production, b: Production) => a.date.localeCompare(b.date) || (a.createdAt || a.date).localeCompare(b.createdAt || b.date) || a.id.localeCompare(b.id);

export function summarizeProductionGroup(productions: Production[], product: Product | null = null) {
  const stages = new Map<string, { key: string; stageName: string; order: number; isFinal: boolean; quantity: number; pendingQuantity: number }>();
  const hasActive = productions.some(production => productionRemaining(production) > 0);
  for (const original of productions) {
    if (hasActive && productionRemaining(original) <= 0) continue;
    const production = resolveProductionRecipe(original, product);
    const sorted = sortedStages(production);
    sorted.forEach((stage, index) => {
      const isFinal = index === sorted.length - 1;
      const key = liveProductionStageKey(production, index, product);
      const current = stages.get(key) || { key, stageName: stage.stageName, order: stage.order, isFinal, quantity: 0, pendingQuantity: 0 };
      if (productionRemaining(production) > 0) {
        // These are exclusive queues, not cumulative completions. Finished
        // units have left every queue, including records completed in part.
        current.quantity = round(current.quantity + Math.max(0, Math.min(productionRemaining(production), stageAvailable(production, index))));
        current.pendingQuantity = round(current.pendingQuantity + Math.max(0, stage.plannedQuantity - Math.max(stage.completedQuantity, production.quantityProduced)));
      }
      stages.set(key, current);
    });
  }
  return { remaining: round(productions.reduce((sum, production) => sum + productionRemaining(production), 0)),
    stages: [...stages.values()].sort((a, b) => a.order - b.order || a.stageName.localeCompare(b.stageName)) };
}

export function groupActiveProductions(productions: Production[], products: Product[] = []) {
  const groups = new Map<string, Production[]>();
  for (const production of productions) {
    if (productionRemaining(production) <= 0) continue;
    const key = production.productId || production.id;
    groups.set(key, [...(groups.get(key) || []), production]);
  }
  return [...groups.entries()].map(([key, records]) => {
    const ordered = records.sort(oldestFirst);
    return { key, productions: ordered, ...summarizeProductionGroup(ordered, products.find(product => product.id === ordered[0].productId) || null) };
  }).sort((a, b) => b.productions.at(-1)!.date.localeCompare(a.productions.at(-1)!.date));
}

function mergeDeductions(current: ProductionIngredientDeduction[], additions: ProductionIngredientDeduction[]) {
  const merged = current.map(item => ({ ...item }));
  for (const addition of additions) {
    const old = merged.find(item => item.type === addition.type && item.targetId === addition.targetId);
    if (!old) merged.push({ ...addition });
    else Object.assign(old, { quantityTotal: round(old.quantityTotal + addition.quantityTotal), totalCost: round(old.totalCost + addition.totalCost),
      stockAfter: addition.stockAfter, unitCost: addition.unitCost, quantityPerBatch: Math.max(old.quantityPerBatch, addition.quantityPerBatch) });
  }
  return merged;
}

function mergeForecast(current: ConsumptionForecastNode[], additions: ConsumptionForecastNode[]) {
  const merged = current.map(node => ({ ...node, children: mergeForecast([], node.children) }));
  for (const addition of additions) {
    const old = merged.find(node => node.item.type === addition.item.type && node.item.targetId === addition.item.targetId && node.isVirtualRecipe === addition.isVirtualRecipe);
    if (!old) merged.push({ ...addition, children: mergeForecast([], addition.children) });
    else Object.assign(old, { quantityTotal: round(old.quantityTotal + addition.quantityTotal), stockQuantity: round(old.stockQuantity + addition.stockQuantity),
      manufactureQuantity: round(old.manufactureQuantity + addition.manufactureQuantity),
      stockAfter: addition.stockAfter == null ? old.stockAfter : (old.stockAfter || 0) < 0 || addition.stockAfter < 0
        ? round(Math.min(0, old.stockAfter || 0) + Math.min(0, addition.stockAfter)) : addition.stockAfter,
      children: mergeForecast(old.children, addition.children) });
  }
  return merged;
}

export interface ProductionStageAdvance {
  previous: Production;
  production: Production;
  deductions: ProductionIngredientDeduction[];
  finishedQuantityDelta: number;
  expectedRecipe: string;
}

/** Consume only work not already executed for each recipe row. This keeps
 * moved/merged ingredients from being consumed twice after a recipe edit. */
function getStagePlan(production: Production, stageId: string, quantity: number, product: Product, materials: Material[], products: Product[]) {
  const start = production.stageProgress?.find(stage => stage.stageId === stageId)?.completedQuantity || 0;
  const items = (production.recipeItemsSnapshot || product.items).filter(item => item.productionStageId === stageId).map(item => {
    const completed = production.recipeProgress?.items[item.id] ?? start;
    const units = Math.max(0, start + quantity - Math.max(start, completed));
    return { ...item, quantity: quantity > 0 ? item.quantity * units / quantity : 0 };
  });
  return getProductionPlan({ ...product, items, batchYield: Math.max(0.0001, production.batchYield || 1) }, quantity, materials, products, production.variableSelections);
}

export function projectProductionCost(original: Production, product: Product, materials: Material[], products: Product[]) {
  const production = resolveProductionRecipe(original, product);
  if (production.status !== 'in_progress') return production.totalCost;
  let projected = production.totalCost, balances = materials, productBalances = products;
  const yieldQty = Math.max(0.0001, production.batchYield || 1);
  for (const stage of sortedStages(production)) {
    const units = Math.max(0, stage.plannedQuantity - stage.completedQuantity);
    if (!units) continue;
    const plan = getStagePlan(production, stage.stageId, units, product, balances, productBalances);
    const laborUnits = Math.max(0, stage.plannedQuantity - Math.max(stage.completedQuantity, production.recipeProgress?.labor[stage.stageId] || 0));
    projected += plan.deductions.reduce((sum, item) => sum + item.totalCost, 0) + plan.virtualPreparationCost * units / yieldQty
      + (stage.laborMinutes || 0) / 60 * (product.hourlyRate || 0) * laborUnits / yieldQty;
    balances = balances.map(material => ({ ...material, currentStock: Math.max(0, material.currentStock - (plan.deductions.find(item => item.type === 'material' && item.targetId === material.id)?.quantityTotal || 0)) }));
    productBalances = productBalances.map(current => ({ ...current, currentStock: Math.max(0, (current.currentStock || 0) - (plan.deductions.find(item => item.type === 'product' && item.targetId === current.id)?.quantityTotal || 0)) }));
  }
  return round(projected + ((product.fixedCost || 0) + (product.otherCosts || 0)) * productionRemaining(production) / yieldQty);
}

/** Allocate the selected phase oldest first, using the current recipe
 * and preserving work already executed for each record. Shared stock is replanned after every allocation. */
export function planGroupedStageAdvance(productions: Production[], key: string, quantity: number, product: Product | null, materials: Material[], products: Product[]) {
  const summary = summarizeProductionGroup(productions, product);
  const selected = summary.stages.find(stage => stage.key === key);
  const simulate = quantity > (selected?.quantity || 0);
  let remaining = Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
  let balances = materials, productBalances = products;
  let forecast: ConsumptionForecastNode[] = [];
  const advances: ProductionStageAdvance[] = [], errors: string[] = [];
  let shortage = false;
  for (const previous of [...productions].sort(oldestFirst)) {
    if (!remaining || productionRemaining(previous) <= 0) continue;
    const live = resolveProductionRecipe(previous, product);
    const stages = sortedStages(live);
    const index = stages.findIndex((stage, index) => liveProductionStageKey(live, index, product) === key);
    if (index < 0) continue;
    const stage = stages[index];
    const available = simulate ? Math.max(0, stage.plannedQuantity - Math.max(stage.completedQuantity, live.quantityProduced)) : stageAvailable(live, index);
    const allocated = Math.min(remaining, available);
    if (!allocated) continue;
    if (!product) { errors.push('Não foi possível localizar a receita desta produção.'); break; }
    const batchYield = Math.max(0.0001, live.batchYield || 1);
    const plan = getStagePlan(live, stage.stageId, allocated, product, balances, productBalances);
    errors.push(...plan.errors);
    const tracksStock = previous.stockTrackingEnabled !== false;
    shortage ||= tracksStock && plan.hasStockShortage;
    forecast = mergeForecast(forecast, plan.forecast);
    const deductions = tracksStock ? plan.deductions.map(item => ({ ...item, stockAfter: Math.max(0, round(item.stockAfter)) })) : plan.deductions;
    const progress = stages.map(current => current.stageId !== stage.stageId ? current : { ...current,
      completedQuantity: round(current.completedQuantity + allocated), deductedItems: mergeDeductions(current.deductedItems || [], deductions) });
    const factor = allocated / batchYield;
    const ready = Math.min(productionTarget(live), ...progress.map(stage => stage.completedQuantity));
    const finishedQuantityDelta = Math.max(0, round(ready - previous.quantityProduced));
    const completed = ready >= productionTarget(live) - 0.0001;
    const laborUnits = Math.max(0, stage.completedQuantity + allocated - Math.max(stage.completedQuantity, live.recipeProgress?.labor[stage.stageId] || 0));
    const itemProgress = { ...live.recipeProgress?.items };
    for (const item of live.recipeItemsSnapshot || []) if (item.productionStageId === stage.stageId) itemProgress[item.id] = Math.max(itemProgress[item.id] || 0, stage.completedQuantity + allocated);
    const production: Production = { ...live, status: completed ? 'completed' : 'in_progress',
      quantityProduced: round(previous.quantityProduced + finishedQuantityDelta),
      recipeProgress: { items: itemProgress, labor: { ...live.recipeProgress?.labor, [stage.stageId]: Math.max(live.recipeProgress?.labor[stage.stageId] || 0, stage.completedQuantity + allocated) } },
      totalCost: round(previous.totalCost + deductions.reduce((sum, item) => sum + item.totalCost, 0) + plan.virtualPreparationCost * factor
        + (stage.laborMinutes || 0) / 60 * (product.hourlyRate || 0) * laborUnits / batchYield + ((product.fixedCost || 0) + (product.otherCosts || 0)) * finishedQuantityDelta / batchYield),
      deductedItems: mergeDeductions(previous.deductedItems || [], deductions), stageProgress: progress,
      automaticManufacturing: tracksStock ? [...(previous.automaticManufacturing || []), ...plan.automaticManufacturing] : previous.automaticManufacturing,
      completedAt: completed ? localDateString() : undefined };
    advances.push({ previous, production, deductions, finishedQuantityDelta, expectedRecipe: productionRecipeFingerprint(product) });
    if (tracksStock) {
      balances = balances.map(material => ({ ...material, currentStock: Math.max(0, material.currentStock - (deductions.find(item => item.type === 'material' && item.targetId === material.id)?.quantityTotal || 0)) }));
      productBalances = productBalances.map(current => ({ ...current, currentStock: Math.max(0, (current.currentStock || 0) - (deductions.find(item => item.type === 'product' && item.targetId === current.id)?.quantityTotal || 0))
        + (current.id === previous.productId ? finishedQuantityDelta : 0) }));
    }
    production.plannedTotalCost = projectProductionCost(production, product, balances, productBalances);
    remaining -= allocated;
  }
  return { advances, forecast, shortage, errors: [...new Set(errors)],
    canRegister: !!selected && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= selected.quantity && remaining === 0 };
}

/** Reading a recipe is independent of whether its phase can still be saved.
 * Use the actual allocation when available; otherwise simulate the requested
 * units from the current recipe, without constructing progress updates. */
export function previewGroupedStage(productions: Production[], key: string, quantity: number, product: Product | null, materials: Material[], products: Product[]) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { forecast: [], errors: [] };
  if (!product) return { forecast: [], errors: ['Não foi possível localizar a receita desta produção.'] };
  const registration = planGroupedStageAdvance(productions, key, quantity, product, materials, products);
  if (registration.canRegister) return { forecast: registration.forecast, errors: registration.errors };
  const matching = [...productions].sort(oldestFirst).flatMap(production => {
    const live = resolveProductionRecipe(production, product);
    const stages = sortedStages(live);
    const stage = stages.find((stage, index) => liveProductionStageKey(live, index, product) === key);
    return stage ? [{ production: live, stage }] : [];
  });
  const active = matching.filter(({ production }) => productionRemaining(production) > 0);
  const sources = active.length ? active : matching;
  let remaining = quantity, balances = materials, productBalances = products;
  let forecast: ConsumptionForecastNode[] = [];
  const errors: string[] = [];
  sources.forEach(({ production, stage }, index) => {
    const units = index === sources.length - 1 ? remaining : Math.min(remaining, productionRemaining(production) || productionTarget(production));
    if (units <= 0) return;
    const plan = getStagePlan(production, stage.stageId, units, product, balances, productBalances);
    forecast = mergeForecast(forecast, plan.forecast);
    errors.push(...plan.errors);
    if (production.stockTrackingEnabled !== false) {
      balances = balances.map(material => ({ ...material, currentStock: Math.max(0, material.currentStock - (plan.deductions.find(item => item.type === 'material' && item.targetId === material.id)?.quantityTotal || 0)) }));
      productBalances = productBalances.map(current => ({ ...current, currentStock: Math.max(0, (current.currentStock || 0) - (plan.deductions.find(item => item.type === 'product' && item.targetId === current.id)?.quantityTotal || 0)) }));
    }
    remaining -= units;
  });
  return { forecast, errors: [...new Set(errors)] };
}

interface ProductionWorkspace { productions: Production[]; products: Product[]; materials: Material[]; stockMovements?: StockMovement[] }

/** Commit the whole phase together or leave everything unchanged. Repeating
 * an already applied update never produces stock or consumes inputs twice. */
export function applyProductionStageAdvances<T extends ProductionWorkspace>(source: T, advances: ProductionStageAdvance[]): T {
  if (!advances.length) return source;
  if (new Set(advances.map(item => item.production.id)).size !== advances.length) throw new Error('Esta etapa contém registros repetidos. Reabra a produção.');
  const pending = advances.filter(advance => {
    const current = source.productions.find(item => item.id === advance.production.id);
    if (!current) throw new Error('Esta produção foi removida. Reabra a lista.');
    if (canonicalJSON(current) === canonicalJSON(advance.production)) return false;
    if (canonicalJSON(current) !== canonicalJSON(advance.previous)) throw new Error('Esta produção recebeu outra alteração. Reabra a etapa antes de registrar.');
    return true;
  });
  if (!pending.length) return source;
  // Do not accept a partially replayed group against a different stock plan.
  if (pending.length !== advances.length) throw new Error('Parte desta etapa já foi registrada. Reabra a produção.');
  for (const advance of pending) {
    const product = source.products.find(product => product.id === advance.production.productId);
    if (!product || productionRecipeFingerprint(product) !== advance.expectedRecipe) throw new Error('A receita foi atualizada. Confira as próximas etapas antes de registrar.');
    if (advance.production.stockTrackingEnabled !== false) validateAutomaticManufacturing((advance.production.automaticManufacturing || []).slice(advance.previous.automaticManufacturing?.length || 0), source.productions);
  }
  let products = source.products, materials = source.materials;
  const stockMovements = [...(source.stockMovements || [])];
  for (const { previous, production, deductions, finishedQuantityDelta } of pending) {
    if (production.stockTrackingEnabled === false) continue;
    for (const deduction of deductions) {
      const current = deduction.type === 'material' ? materials.find(item => item.id === deduction.targetId) : products.find(item => item.id === deduction.targetId);
      if (!current || Math.abs((current.currentStock || 0) - deduction.stockBefore) > 0.0001) throw new Error('O estoque mudou. Confira a previsão e registre a etapa novamente.');
    }
    const newAutomatic = (production.automaticManufacturing || []).slice(previous.automaticManufacturing?.length || 0);
    const operation = `${production.id}_recipe_${production.recipeHistory?.length || 0}_stage_${production.stageProgress?.reduce((sum, stage) => sum + stage.completedQuantity, 0)}`;
    stockMovements.push(...automaticStockMovements(newAutomatic, operation, production.date, production.id),
      ...deductions.map((item, index) => ({ id: `${operation}_${index}`, date: production.date, targetId: item.targetId, type: item.type, quantity: -item.quantityTotal, reason: 'Etapa de produção', referenceId: production.id })),
      ...(finishedQuantityDelta > 0 ? [{ id: `${operation}_finished`, date: production.date, targetId: production.productId, type: 'product' as const, quantity: finishedQuantityDelta, reason: 'Produto finalizado', referenceId: production.id }] : []));
    materials = materials.map(material => {
      const deduction = deductions.find(item => item.type === 'material' && item.targetId === material.id);
      return !deduction || material.usageType === 'durable' ? material : { ...material, currentStock: Math.max(0, round(material.currentStock - deduction.quantityTotal)), updatedAt: localDateString() };
    });
    products = products.map(product => {
      if (product.id === production.productId && finishedQuantityDelta > 0) {
        const current = product.currentStock || 0, total = current + finishedQuantityDelta;
        const split = getProductFinancialSplit(product);
        return { ...product, currentStock: round(total),
          inventoryBusinessCost: (current * (product.inventoryBusinessCost ?? split.businessCostPerUnit) + finishedQuantityDelta * Math.max(0, (production.targetQuantity ? (production.plannedTotalCost ?? production.totalCost) / production.targetQuantity : production.costPerUnit) - split.laborRemunerationPerUnit)) / total,
          inventoryLaborCost: (current * (product.inventoryLaborCost ?? split.laborRemunerationPerUnit) + finishedQuantityDelta * split.laborRemunerationPerUnit) / total, updatedAt: localDateString() };
      }
      const deduction = deductions.find(item => item.type === 'product' && item.targetId === product.id);
      return !deduction || product.id === production.productId ? product : { ...product, currentStock: Math.max(0, round((product.currentStock || 0) - deduction.quantityTotal)), updatedAt: localDateString() };
    });
  }
  return { ...source, products, materials, stockMovements,
    productions: source.productions.map(production => pending.find(item => item.production.id === production.id)?.production || production) };
}
