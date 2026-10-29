import type { Material, Product, Production, ProductionIngredientDeduction, StockMovement } from '../types';
import { canonicalJSON } from '../services/workspaceRecordStore';
import { automaticStockMovements, validateAutomaticManufacturing, type ConsumptionForecastNode } from './automaticManufacturing';
import { getProductFinancialSplit } from './financials';
import { localDateString } from './localDate';
import { getProductionPlan } from './productionPlanning';

const round = (value: number) => Number(value.toFixed(4));
export const productionTarget = (production: Production) => production.targetQuantity ?? production.batchCount * production.batchYield;
export const productionRemaining = (production: Production) => production.status === 'in_progress'
  ? Math.max(0, round(productionTarget(production) - production.quantityProduced)) : 0;
const sortedStages = (production: Production) => [...(production.stageProgress || [])].sort((a, b) => a.order - b.order);
const stageKey = (stageId: string, final: boolean) => `${stageId}:${final ? 'final' : 'step'}`;
const oldestFirst = (a: Production, b: Production) => a.date.localeCompare(b.date) || (a.createdAt || a.date).localeCompare(b.createdAt || b.date) || a.id.localeCompare(b.id);

export function summarizeProductionGroup(productions: Production[]) {
  const stages = new Map<string, { key: string; stageName: string; order: number; isFinal: boolean; quantity: number; pendingQuantity: number }>();
  for (const production of productions) {
    const sorted = sortedStages(production);
    sorted.forEach((stage, index) => {
      const isFinal = index === sorted.length - 1;
      const key = stageKey(stage.stageId, isFinal);
      const current = stages.get(key) || { key, stageName: stage.stageName, order: stage.order, isFinal, quantity: 0, pendingQuantity: 0 };
      if (productionRemaining(production) > 0) {
        const previous = index === 0 ? productionTarget(production) : sorted[index - 1].completedQuantity;
        // These are exclusive queues, not cumulative completions. Finished
        // units have left every queue, including records completed in part.
        current.quantity = round(current.quantity + Math.max(0, Math.min(productionRemaining(production), previous - Math.max(stage.completedQuantity, production.quantityProduced))));
        current.pendingQuantity = round(current.pendingQuantity + Math.max(0, stage.plannedQuantity - Math.max(stage.completedQuantity, production.quantityProduced)));
      }
      stages.set(key, current);
    });
  }
  return { remaining: round(productions.reduce((sum, production) => sum + productionRemaining(production), 0)),
    stages: [...stages.values()].sort((a, b) => a.order - b.order || a.stageName.localeCompare(b.stageName)) };
}

export function groupActiveProductions(productions: Production[]) {
  const groups = new Map<string, Production[]>();
  for (const production of productions) {
    if (productionRemaining(production) <= 0) continue;
    const key = production.productId || production.id;
    groups.set(key, [...(groups.get(key) || []), production]);
  }
  return [...groups.entries()].map(([key, records]) => {
    const ordered = records.sort(oldestFirst);
    return { key, productions: ordered, ...summarizeProductionGroup(ordered) };
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
}

/** Allocate the selected phase oldest first, using each record's saved recipe
 * and selections. Shared stock is replanned after every allocation. */
export function planGroupedStageAdvance(productions: Production[], key: string, quantity: number, product: Product | null, materials: Material[], products: Product[]) {
  const summary = summarizeProductionGroup(productions);
  const selected = summary.stages.find(stage => stage.key === key);
  const simulate = quantity > (selected?.quantity || 0);
  let remaining = Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
  let balances = materials, productBalances = products;
  let forecast: ConsumptionForecastNode[] = [];
  const advances: ProductionStageAdvance[] = [], errors: string[] = [];
  let shortage = false;
  for (const previous of [...productions].sort(oldestFirst)) {
    if (!remaining || productionRemaining(previous) <= 0) continue;
    const stages = sortedStages(previous);
    const index = stages.findIndex((stage, index) => stageKey(stage.stageId, index === stages.length - 1) === key);
    if (index < 0) continue;
    const stage = stages[index], final = index === stages.length - 1;
    const prior = index === 0 ? productionTarget(previous) : stages[index - 1].completedQuantity;
    const available = Math.max(0, Math.min(stage.plannedQuantity, simulate ? stage.plannedQuantity : prior) - Math.max(stage.completedQuantity, previous.quantityProduced));
    const allocated = Math.min(remaining, available);
    if (!allocated) continue;
    if (!product) { errors.push('Não foi possível localizar a receita desta produção.'); break; }
    const batchYield = Math.max(0.0001, previous.batchYield || 1);
    const items = (previous.recipeItemsSnapshot || product.items).filter(item => item.productionStageId === stage.stageId);
    const plan = getProductionPlan({ ...product, items, batchYield }, allocated, balances, productBalances, previous.variableSelections);
    errors.push(...plan.errors);
    const tracksStock = previous.stockTrackingEnabled !== false;
    shortage ||= tracksStock && plan.hasStockShortage;
    forecast = mergeForecast(forecast, plan.forecast);
    const deductions = tracksStock ? plan.deductions.map(item => ({ ...item, stockAfter: Math.max(0, round(item.stockAfter)) })) : plan.deductions;
    const progress = stages.map(current => current.stageId !== stage.stageId ? current : { ...current,
      completedQuantity: round(current.completedQuantity + allocated), deductedItems: mergeDeductions(current.deductedItems || [], deductions) });
    const factor = allocated / batchYield;
    const finishedQuantityDelta = final ? allocated : 0;
    const completed = final && stage.completedQuantity + allocated >= productionTarget(previous) - 0.0001;
    const production: Production = { ...previous, status: completed ? 'completed' : 'in_progress',
      quantityProduced: round(previous.quantityProduced + finishedQuantityDelta),
      totalCost: round(previous.totalCost + deductions.reduce((sum, item) => sum + item.totalCost, 0) + plan.virtualPreparationCost * factor
        + (stage.laborMinutes || 0) / 60 * (product.hourlyRate || 0) * factor + (final ? ((product.fixedCost || 0) + (product.otherCosts || 0)) * factor : 0)),
      deductedItems: mergeDeductions(previous.deductedItems || [], deductions), stageProgress: progress,
      automaticManufacturing: tracksStock ? [...(previous.automaticManufacturing || []), ...plan.automaticManufacturing] : previous.automaticManufacturing,
      completedAt: completed ? localDateString() : undefined };
    advances.push({ previous, production, deductions, finishedQuantityDelta });
    if (tracksStock) {
      balances = balances.map(material => ({ ...material, currentStock: Math.max(0, material.currentStock - (deductions.find(item => item.type === 'material' && item.targetId === material.id)?.quantityTotal || 0)) }));
      productBalances = productBalances.map(current => ({ ...current, currentStock: Math.max(0, (current.currentStock || 0) - (deductions.find(item => item.type === 'product' && item.targetId === current.id)?.quantityTotal || 0))
        + (current.id === previous.productId ? finishedQuantityDelta : 0) }));
    }
    remaining -= allocated;
  }
  return { advances, forecast, shortage, errors: [...new Set(errors)],
    canRegister: !!selected && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= selected.quantity && remaining === 0 };
}

/** Reading a recipe is independent of whether its phase can still be saved.
 * Use the actual allocation when available; otherwise simulate the requested
 * units from the saved compositions, without constructing progress updates. */
export function previewGroupedStage(productions: Production[], key: string, quantity: number, product: Product | null, materials: Material[], products: Product[]) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { forecast: [], errors: [] };
  if (!product) return { forecast: [], errors: ['Não foi possível localizar a receita desta produção.'] };
  const registration = planGroupedStageAdvance(productions, key, quantity, product, materials, products);
  if (registration.canRegister) return { forecast: registration.forecast, errors: registration.errors };
  const matching = [...productions].sort(oldestFirst).flatMap(production => {
    const stages = sortedStages(production);
    const stage = stages.find((stage, index) => stageKey(stage.stageId, index === stages.length - 1) === key);
    return stage ? [{ production, stage }] : [];
  });
  const active = matching.filter(({ production }) => productionRemaining(production) > 0);
  const sources = active.length ? active : matching;
  let remaining = quantity, balances = materials, productBalances = products;
  let forecast: ConsumptionForecastNode[] = [];
  const errors: string[] = [];
  sources.forEach(({ production, stage }, index) => {
    const units = index === sources.length - 1 ? remaining : Math.min(remaining, productionRemaining(production) || productionTarget(production));
    if (units <= 0) return;
    const items = (production.recipeItemsSnapshot || product.items).filter(item => item.productionStageId === stage.stageId);
    const plan = getProductionPlan({ ...product, items, batchYield: production.batchYield }, units, balances, productBalances, production.variableSelections);
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
  for (const advance of pending) if (advance.production.stockTrackingEnabled !== false) {
    validateAutomaticManufacturing((advance.production.automaticManufacturing || []).slice(advance.previous.automaticManufacturing?.length || 0), source.productions);
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
    const operation = `${production.id}_stage_${production.stageProgress?.reduce((sum, stage) => sum + stage.completedQuantity, 0)}`;
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
