import type { Product, Production, ProductionStageDefinition, RecipeItem } from '../types';
import { canonicalJSON } from '../services/workspaceRecordStore';
import { localDateString } from './localDate';

export const productionStageKey = (stageId: string, final: boolean) => `${stageId}:${final ? 'final' : 'step'}`;
export const orderedProductionStages = (production: Production) => [...(production.stageProgress || [])].sort((a, b) => a.order - b.order);
export const productionTarget = (production: Production) => production.targetQuantity ?? production.batchCount * production.batchYield;
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
export const productionRecipeFingerprint = (product: Product) => canonicalJSON({ items: product.items, batchYield: product.batchYield,
  stages: currentProductionStages(product), hourlyRate: product.hourlyRate, fixedCost: product.fixedCost, otherCosts: product.otherCosts });

export function currentProductionStages(product: Product): ProductionStageDefinition[] {
  return product.useProductionStages && product.productionStages?.length
    ? [...product.productionStages].sort((a, b) => a.order - b.order)
    : [{ id: 'current_recipe_finish', name: 'Finalização', order: 0, laborMinutes: product.productionTimeMinutes || 0 }];
}

export function currentProductionItems(product: Product): RecipeItem[] {
  const stages = currentProductionStages(product);
  return product.items.map(item => ({ ...item, productionStageId: stages.some(stage => stage.id === item.productionStageId) ? item.productionStageId : stages[0].id }));
}

export function liveProductionStageKey(production: Production, index: number, product: Product | null) {
  const stages = orderedProductionStages(production), stage = stages[index];
  const final = production.status === 'in_progress' && product
    ? stage.stageId === 'current_recipe_release' || stage.stageId === currentProductionStages(product).at(-1)?.id
    : index === stages.length - 1;
  return productionStageKey(stage.stageId, final);
}

/** Derive the next steps without writing on open. Preserve executed unit
 * frontiers, even if ingredients move between stages or stages are merged.
 * The original definition is archived only when a new step is actually saved. */
export function resolveProductionRecipe(production: Production, product: Product | null): Production {
  if (production.status !== 'in_progress' || !product) return production;
  const target = productionTarget(production), finished = production.quantityProduced || 0;
  const stages = currentProductionStages(product), items = currentProductionItems(product);
  const oldStages = orderedProductionStages(production);
  const oldItems = production.recipeItemsSnapshot || items;
  const itemProgress = { ...(production.recipeProgress?.items || {}) };
  const laborProgress = { ...(production.recipeProgress?.labor || {}) };
  for (const item of oldItems) if (itemProgress[item.id] == null) {
    itemProgress[item.id] = Math.max(finished, oldStages.find(stage => stage.stageId === item.productionStageId)?.completedQuantity || 0);
  }
  const aliased = new Set<string>();
  for (const item of items) if (itemProgress[item.id] == null) {
    const candidates = oldItems.filter(old => old.type === item.type && old.targetId === item.targetId && !items.some(current => current.id === old.id));
    if (candidates.length === 1 && items.filter(current => current.type === item.type && current.targetId === item.targetId).length === 1) {
      itemProgress[item.id] = itemProgress[candidates[0].id];
      aliased.add(item.id);
    }
  }
  for (const stage of oldStages) if (laborProgress[stage.stageId] == null) laborProgress[stage.stageId] = Math.max(finished, stage.completedQuantity);
  const matched = new Set<string>();
  const progress = stages.map(stage => {
    const named = oldStages.filter(old => normalized(old.stageName) === normalized(stage.name) && !matched.has(old.stageId)
      && !stages.some(current => current.id === old.stageId));
    const old = oldStages.find(old => old.stageId === stage.id && !matched.has(old.stageId)) || (named.length === 1 ? named[0] : undefined);
    if (old) matched.add(old.stageId);
    const stageItems = items.filter(item => item.productionStageId === stage.id);
    const savedFrontiers = stageItems.filter(item => itemProgress[item.id] != null).map(item => itemProgress[item.id]);
    const inherited = old?.completedQuantity ?? (savedFrontiers.length ? Math.min(...savedFrontiers) : laborProgress[stage.id] ?? finished);
    for (const item of stageItems) if (itemProgress[item.id] == null || (!aliased.has(item.id) && !oldItems.some(previous => previous.id === item.id))) itemProgress[item.id] = Math.max(finished, inherited, itemProgress[item.id] || 0);
    const completedQuantity = Math.min(target, Math.max(finished, Math.min(inherited, ...stageItems.map(item => itemProgress[item.id]))));
    laborProgress[stage.id] = Math.max(finished, laborProgress[stage.id] ?? (old ? laborProgress[old.stageId] : completedQuantity));
    return { stageId: stage.id, stageName: stage.name, order: stage.order, plannedQuantity: target, completedQuantity,
      laborMinutes: stage.laborMinutes || 0, deductedItems: old?.deductedItems || [] };
  });
  // If a removed phase leaves pieces ready, require an explicit confirmation
  // before entering finished stock. Merely opening the updated recipe is read-only.
  if (progress.length && Math.min(...progress.map(stage => stage.completedQuantity)) > finished) {
    stages.push({ id: 'current_recipe_release', name: 'Conferir finalização', order: Math.max(...stages.map(stage => stage.order)) + 1, laborMinutes: 0 });
    progress.push({ stageId: 'current_recipe_release', stageName: 'Conferir finalização', order: stages.at(-1)!.order,
      plannedQuantity: target, completedQuantity: finished, laborMinutes: 0, deductedItems: [] });
    laborProgress.current_recipe_release = finished;
  }
  const priorDefinition = { items: oldItems, stages: oldStages.map(stage => ({ id: stage.stageId, name: stage.stageName, order: stage.order, laborMinutes: stage.laborMinutes })), batchYield: production.batchYield };
  const nextDefinition = { items, stages, batchYield: Math.max(0.0001, product.batchYield || 1) };
  const changed = canonicalJSON(priorDefinition) !== canonicalJSON(nextDefinition);
  return { ...production, batchYield: nextDefinition.batchYield, batchCount: target / nextDefinition.batchYield, targetQuantity: target,
    recipeItemsSnapshot: items, productionStagesSnapshot: stages, stageProgress: progress,
    recipeProgress: { items: itemProgress, labor: laborProgress },
    recipeHistory: changed ? [...(production.recipeHistory || []), { id: `${production.id}_recipe_${(production.recipeHistory?.length || 0) + 1}`,
      date: localDateString(), batchYield: production.batchYield, items: oldItems, stages: oldStages }] : production.recipeHistory };
}

/** Every unfinished piece belongs to its earliest remaining phase. Prefix
 * minima handle inserted/reordered stages without counting a piece twice. */
export function stageAvailable(production: Production, index: number) {
  const stages = orderedProductionStages(production);
  const prior = index === 0 ? productionTarget(production) : Math.min(productionTarget(production), ...stages.slice(0, index).map(stage => stage.completedQuantity));
  return Math.max(0, prior - Math.max(stages[index]?.completedQuantity || 0, production.quantityProduced));
}
