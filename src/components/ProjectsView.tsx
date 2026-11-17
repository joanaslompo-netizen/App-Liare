import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  ClipboardList,
  CalendarDays,
  CheckCircle2,
  Circle,
  Edit2,
  Copy,
  Trash2,
  X,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Target,
} from 'lucide-react';
import {
  Material,
  Product,
  ProductionProject,
  ProjectChecklistItem,
  ProjectMaterialLine,
  ProjectProductLine,
  ProjectRecipeItem,
  RecipeItem,
} from '../types';
import { formatCurrency, formatNumber, UNIT_SHORT } from '../utils/formatters';
import { SearchableProductCombobox } from './SearchableProductCombobox';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';
import { ProjectMaterialQuoteDetails, ProjectSimulatedMaterialForm } from './ProjectSimulatedMaterialForm';
import { RecipeCard } from './RecipeCard';
import { calculateRecipePricing, getCatalogRecipeFinancials } from '../utils/financials';
import { getEmbeddedRecipeLaborCost } from '../utils/storage';
import { duplicateProjectRecipe, isRecipeSimulation } from '../utils/projectSimulation';
import { expandVirtualRecipeItems, getCategoryMaterialOptions, getVirtualMaterialRequirements, materialRecipeCosts } from '../utils/virtualMaterials';

interface ProjectsViewProps {
  projects: ProductionProject[];
  products: Product[];
  materials: Material[];
  onSaveProject: (project: ProductionProject, approvalLineId?: string) => boolean;
  onDeleteProject: (id: string) => void;
}

type Requirement = {
  key: string;
  type: 'material' | 'product' | 'category' | 'durable';
  targetId?: string;
  name: string;
  unit: string;
  required: number;
  available?: number;
  unitCost: number;
  needsChoice?: boolean;
};

const today = () => new Date().toISOString().split('T')[0];

const getProductUnitCost = (product: Product) =>
  product.unitCostFromBatch > 0 ? product.unitCostFromBatch : product.totalCost;

const getProjectMaterialUnitCost = (material: Material | undefined, materials: Material[], products: Product[], choices?: Record<string, string>) =>
  !material || material.usageType === 'durable' ? 0 : material.isVirtualRecipe
    ? materialRecipeCosts(material, materials, choices, new Set(), products).unitCost : material.unitCost || 0;

const selectionKey = (choices?: Record<string, string>) => JSON.stringify(Object.entries(choices || {}).filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b)));

function configuredChoices(material: Material, choices: Record<string, string>, materials: Material[], products: Product[]) {
  if (!material.isVirtualRecipe) return undefined;
  const result = expandVirtualRecipeItems([{ id: 'draft', type: 'material', targetId: material.id, name: material.name,
    quantity: 1, unit: material.unit, unitCost: 0, totalCost: 0, categorySelections: choices }], materials, products);
  if (result.errors.length) throw new Error(result.errors[0]);
  return Object.fromEntries(getVirtualMaterialRequirements(material, materials, choices).map(requirement => [requirement.recipeItemId, choices[requirement.recipeItemId]]).filter(([, value]) => value));
}

function ProjectMaterialChoices({ id, material, choices, materials, onChange }: {
  key?: string; id: string; material: Material | null | undefined; choices?: Record<string, string>; materials: Material[]; onChange: (choices: Record<string, string>) => void;
}) {
  const requirements = useMemo(() => material?.isVirtualRecipe ? getVirtualMaterialRequirements(material, materials, choices) : [], [material, materials, choices]);
  if (!requirements.length) return null;
  return <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 space-y-2" aria-label={`Configurar ${material!.name}`} data-project-choice={id}>
    <p className="text-xs font-semibold text-purple-950">Defina o aroma de {material!.name}</p>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{requirements.map((requirement, index) => <div key={requirement.recipeItemId} className="min-w-0">
      <label htmlFor={`${id}-${index}`} className="mb-1 block text-xs font-semibold text-stone-700">{requirement.category} · {requirement.virtualMaterialName}</label>
      <SearchableMaterialCombobox id={`${id}-${index}`} materials={getCategoryMaterialOptions(materials, requirement.category, requirement.unit, requirement.ancestors)} selectedMaterialId={choices?.[requirement.recipeItemId] || ''} onSelectMaterial={selected => onChange({ ...choices, [requirement.recipeItemId]: selected?.id || '' })} placeholder={`Escolha um material de ${requirement.category}...`} />
    </div>)}</div>
    <p className="text-[11px] text-purple-700">A escolha fica salva neste projeto e atualiza a previsão de materiais e custos.</p>
  </div>;
}

const getCustomLineFinancials = (
  line: Pick<ProjectProductLine, 'customRecipeItems' | 'batchYield' | 'targetSalePrice' | 'recipePricing'>,
  products: Product[],
  materials: Material[]
) => {
  const yieldQty = Math.max(0.0001, line.batchYield || 1);
  const batchCost = (line.customRecipeItems || []).reduce((sum, item) => {
    if (item.materialQuote) return sum + item.totalCost;
    if (item.type === 'material') {
      const material = materials.find((m) => m.id === item.targetId);
      if (material?.usageType === 'durable') return sum;
      return sum + item.quantity * (material ? getProjectMaterialUnitCost(material, materials, products, item.categorySelections) : item.unitCost || 0);
    }
    const product = products.find((p) => p.id === item.targetId);
    return sum + item.quantity * (product ? getProductUnitCost(product) : item.unitCost || 0);
  }, 0);
  const pricing = line.recipePricing;
  const laborCost = ((pricing?.productionTimeMinutes || 0) / 60) * (pricing?.hourlyRate || 0);
  const otherCosts = pricing?.otherCosts || 0;
  const { fixedCost } = calculateRecipePricing(batchCost, laborCost, pricing?.fixedCostPercent || 0, otherCosts, yieldQty, 0);
  const items = (line.customRecipeItems || []).filter(item => !item.materialQuote);
  return {
    materialsCost: batchCost / yieldQty,
    embeddedLaborCost: getEmbeddedRecipeLaborCost(items, materials, products) / yieldQty,
    laborCost: laborCost / yieldQty,
    fixedCost: fixedCost / yieldQty,
    otherCosts: otherCosts / yieldQty,
    batchYield: 1,
    salePrice: line.targetSalePrice || undefined,
  };
};

const getCustomLineUnitCost = (line: Parameters<typeof getCustomLineFinancials>[0], products: Product[], materials: Material[]) => {
  const cost = getCustomLineFinancials(line, products, materials);
  return cost.materialsCost + cost.laborCost + cost.fixedCost + cost.otherCosts;
};

function ProjectRecipeCard({ line, product, products, materials, children }: {
  key?: string;
  line: ProjectProductLine;
  product?: Product | null;
  products: Product[];
  materials: Material[];
  children: React.ReactNode;
}) {
  const custom = line.source === 'custom';
  const items = line.customRecipeItems || [];
  const financials = product ? getCatalogRecipeFinancials(product) : custom ? getCustomLineFinancials(line, products, materials) : undefined;
  const recipe = product || { name: line.name, items, batchYield: line.batchYield, notes: line.notes, productionTimeMinutes: line.recipePricing?.productionTimeMinutes };
  const badge = custom
    ? isRecipeSimulation(line) ? 'Simulação' : line.approvedAt ? 'Aprovada' : 'Personalizada'
    : undefined;

  return (
    <RecipeCard recipe={recipe} financials={financials} badge={badge} groupLabel={recipe.name} heading="h4" showProfit>
      <div className="space-y-3 p-4">
        {product && <p className="text-xs font-semibold text-stone-600">Estoque atual: {formatNumber(product.currentStock ?? 0, 4)} un</p>}
        {!product && !custom && <p className="text-xs text-stone-600">Receita do catálogo indisponível.</p>}
        {children}
      </div>
    </RecipeCard>
  );
}

const plannedLines = (project: ProductionProject) => project.lines.filter(line => !isRecipeSimulation(line));

const getProjectPlannedUnits = (project: ProductionProject) =>
  plannedLines(project).reduce((sum, line) => sum + Math.max(0, line.quantity || 0), 0);

const getDirectMaterialsCost = (
  project: ProductionProject,
  materials: Material[],
  products: Product[]
) => {
  const plannedUnits = getProjectPlannedUnits(project);
  return (project.directMaterials || []).reduce((sum, line) => {
    const material = materials.find((m) => m.id === line.materialId);
    if (material?.usageType === 'durable') return sum;
    const multiplier = line.scope === 'per_unit' ? plannedUnits : 1;
    return sum + Math.max(0, line.quantity || 0) * multiplier * getProjectMaterialUnitCost(material, materials, products, line.categorySelections);
  }, 0);
};

const getLineRecipe = (
  line: ProjectProductLine,
  products: Product[]
): { items: RecipeItem[]; batchYield: number; unitCost: number; salePrice: number } => {
  if (line.source === 'custom') {
    return {
      items: line.customRecipeItems || [],
      batchYield: line.batchYield || 1,
      unitCost: 0,
      salePrice: line.targetSalePrice || 0,
    };
  }

  const product = products.find((p) => p.id === line.productId);
  return {
    items: product?.items || [],
    batchYield: product?.batchYield || 1,
    unitCost: product ? getProductUnitCost(product) : 0,
    salePrice: product?.actualPrice || 0,
  };
};

const buildRequirements = (
  project: ProductionProject,
  products: Product[],
  materials: Material[]
): Requirement[] => {
  const map = new Map<string, Requirement>();

  const add = (req: Requirement) => {
    const current = map.get(req.key);
    if (current) {
      current.required = req.type === 'durable'
        ? Math.max(current.required, req.required)
        : current.required + req.required;
      return;
    }
    map.set(req.key, { ...req });
  };

  const addRecipeItem = (item: RecipeItem, multiplier: number, visitedVirtual = new Set<string>(), selections: Record<string, string> = {}) => {
    if (item.type === 'material') {
      if (item.selectionMode === 'category' && item.targetCategory) {
        const selected = getCategoryMaterialOptions(materials, item.targetCategory, item.unit, [...visitedVirtual]).find(material => material.id === selections[item.id]);
        if (selected) {
          addRecipeItem({ ...item, selectionMode: 'fixed', targetId: selected.id }, multiplier, visitedVirtual, selections);
          return;
        }
        add({
          key: `category:${item.targetCategory}`,
          type: 'category',
          name: `Escolher em: ${item.targetCategory}`,
          unit: item.unit,
          required: item.quantity * multiplier,
          unitCost: item.unitCost || 0,
          needsChoice: true,
        });
        return;
      }

      const material = materials.find((m) => m.id === item.targetId);

      if (material?.usageType === 'durable') {
        add({
          key: `durable:${item.targetId}:${item.durableOption || ''}`,
          type: 'durable',
          targetId: item.targetId,
          name: item.durableOption ? `${material.name} — ${item.durableOption}` : material.name,
          unit: 'un',
          required: Math.max(1, item.quantity || 1),
          available: material.currentStock ?? 0,
          unitCost: 0,
        });
        return;
      }

      if (
        material?.isVirtualRecipe &&
        material.recipeItems?.length &&
        material.batchYield &&
        !visitedVirtual.has(material.id)
      ) {
        const nextVisited = new Set(visitedVirtual);
        nextVisited.add(material.id);
        const virtualMultiplier = multiplier * (item.quantity / material.batchYield);
        const prefix = `${item.id}::${material.id}::`;
        const choices = { ...item.categorySelections, ...Object.fromEntries(Object.entries(selections)
          .filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value])) };
        material.recipeItems.forEach((child) => addRecipeItem(child, virtualMultiplier, nextVisited, choices));
        return;
      }

      add({
        key: `material:${item.targetId}`,
        type: 'material',
        targetId: item.targetId,
        name: material?.name || item.name,
        unit: material?.unit || item.unit,
        required: item.quantity * multiplier,
        available: material?.currentStock ?? 0,
        unitCost: material?.unitCost ?? item.unitCost ?? 0,
      });
      return;
    }

    const product = products.find((p) => p.id === item.targetId);
    add({
      key: `product:${item.targetId}`,
      type: 'product',
      targetId: item.targetId,
      name: product?.name || item.name,
      unit: 'un',
      required: item.quantity * multiplier,
      available: product?.currentStock ?? 0,
      unitCost: product ? getProductUnitCost(product) : item.unitCost || 0,
    });
  };

  plannedLines(project).forEach((line) => {
    if (line.quantity <= 0) return;
    const recipe = getLineRecipe(line, products);
    const multiplier = line.quantity / Math.max(0.0001, recipe.batchYield || 1);
    recipe.items.forEach((item) => addRecipeItem(item, multiplier));
  });

  const plannedUnits = getProjectPlannedUnits(project);
  (project.directMaterials || []).forEach((line) => {
    if (line.quantity <= 0) return;
    const material = materials.find((m) => m.id === line.materialId);
    const multiplier = line.scope === 'per_unit' ? plannedUnits : 1;
    addRecipeItem(
      {
        id: line.id,
        type: 'material',
        targetId: line.materialId,
        name: material?.name || line.name,
        quantity: line.quantity,
        unit: material?.unit || line.unit,
        unitCost: material?.usageType === 'durable' ? 0 : material?.unitCost || 0,
        totalCost: 0,
        categorySelections: line.categorySelections,
      },
      multiplier
    );
  });

  return Array.from(map.values()).sort((a, b) => {
    const aMissing = a.available !== undefined && a.required > a.available;
    const bMissing = b.available !== undefined && b.required > b.available;
    if (aMissing !== bMissing) return aMissing ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  });
};

const statusLabel: Record<ProductionProject['status'], string> = {
  planning: 'Planejamento',
  in_progress: 'Em produção',
  completed: 'Finalizado',
};

const statusClass: Record<ProductionProject['status'], string> = {
  planning: 'bg-stone-100 text-stone-700 border-stone-200',
  in_progress: 'bg-amber-100 text-amber-900 border-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  products,
  materials,
  onSaveProject,
  onDeleteProject,
}) => {
  const [editingProject, setEditingProject] = useState<ProductionProject | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openNew = () => {
    const now = today();
    setEditingProject({
      id: `project_${crypto.randomUUID()}`,
      name: '',
      status: 'planning',
      notes: '',
      dueDate: '',
      lines: [],
      directMaterials: [],
      checklist: [],
      createdAt: now,
      updatedAt: now,
    });
  };

  const closeEditor = () => {
    setEditingProject(null);
    window.scrollTo(0, 0);
  };

  const ordered = useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
      }),
    [projects]
  );

  if (editingProject) {
    return (
      <ProjectEditor
        project={editingProject}
        products={products}
        materials={materials}
        onClose={closeEditor}
        onSave={(project, approvalLineId) => {
          if (onSaveProject(project, approvalLineId)) closeEditor();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[21px] font-bold text-stone-900 tracking-tight">Projetos de Produção</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Planeje várias receitas de uma vez, calcule insumos, custos e acompanhe o andamento.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          Novo Projeto
        </button>
      </div>

      {ordered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center text-amber-700 mb-4">
            <ClipboardList className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">Nenhum projeto criado ainda</h3>
          <p className="text-sm text-stone-500 max-w-lg mx-auto mt-1 mb-5">
            Crie um projeto para planejar coleções, encomendas grandes, datas comemorativas ou reposições de estoque.
          </p>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            Criar Primeiro Projeto
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {ordered.map((project) => {
            const planned = getProjectPlannedUnits(project);
            const production = plannedLines(project);
            const produced = production.reduce(
              (sum, line) => sum + Math.min(Math.max(0, line.producedQuantity || 0), Math.max(0, line.quantity || 0)),
              0
            );
            const progress = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0;
            const requirements = buildRequirements(project, products, materials);
            const missingCount = requirements.filter(
              (r) => r.available !== undefined && r.required > r.available + 0.000001
            ).length;
            const projectedCost = production.reduce((sum, line) => {
              if (line.source === 'custom') {
                return sum + getCustomLineUnitCost(line, products, materials) * line.quantity;
              }
              const product = products.find((p) => p.id === line.productId);
              return sum + (product ? getProductUnitCost(product) : 0) * line.quantity;
            }, 0) + getDirectMaterialsCost(project, materials, products);
            const projectedRevenue = production.reduce((sum, line) => {
              if (line.source === 'custom') return sum + (line.targetSalePrice || 0) * line.quantity;
              const product = products.find((p) => p.id === line.productId);
              return sum + (product?.actualPrice || 0) * line.quantity;
            }, 0);
            const expanded = expandedId === project.id;

            return (
              <article key={project.id} aria-label={project.name} className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-stone-900">{project.name || 'Projeto sem nome'}</h3>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${statusClass[project.status]}`}>
                          {statusLabel[project.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-stone-500">
                        {project.dueDate && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            Prazo {new Date(project.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        <span>
                          {project.lines.length + (project.directMaterials?.length || 0)} {(project.lines.length + (project.directMaterials?.length || 0)) === 1 ? 'item' : 'itens'}
                        </span>
                        <span>{formatNumber(planned)} un planejadas</span>
                        {missingCount > 0 && (
                          <span className="text-rose-700 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {missingCount} {missingCount === 1 ? 'falta de estoque' : 'faltas de estoque'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingProject(project)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Excluir o projeto "${project.name}"?`)) onDeleteProject(project.id);
                        }}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Excluir projeto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    <SummaryBox label="Produção" value={`${formatNumber(produced)} / ${formatNumber(planned)} un`} icon={Target} />
                    <SummaryBox label="Custo previsto" value={formatCurrency(projectedCost)} icon={DollarSign} />
                    <SummaryBox label="Venda potencial" value={formatCurrency(projectedRevenue)} icon={Sparkles} />
                    <SummaryBox label="Checklist" value={`${project.checklist.filter((i) => i.completed).length} / ${project.checklist.length}`} icon={CheckCircle2} />
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                      <span>Progresso do projeto</span>
                      <span className="font-semibold text-stone-700">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : project.id)}
                    className="mt-4 text-xs font-semibold text-amber-800 hover:text-amber-900 inline-flex items-center gap-1"
                  >
                    {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {expanded ? 'Ocultar detalhes' : 'Ver materiais, receitas e anotações'}
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-stone-200 bg-stone-50/60 p-5 space-y-5">
                    <ProjectDetails project={project} products={products} materials={materials} requirements={requirements} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

    </div>
  );
};

const SummaryBox = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
    <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
    <div className="text-sm font-bold text-stone-900 mt-1">{value}</div>
  </div>
);

const ProjectDetails = ({
  project,
  products,
  materials,
  requirements,
}: {
  project: ProductionProject;
  products: Product[];
  materials: Material[];
  requirements: Requirement[];
}) => (
  <>
    <div>
      <h4 className="text-xs font-bold text-stone-800 mb-2">Receitas do projeto</h4>
      <div className="grid gap-4 lg:grid-cols-2">
        {project.lines.length === 0 ? (
          <p className="text-xs text-stone-500">Nenhum produto adicionado.</p>
        ) : (
          project.lines.map((line) => {
            const simulation = isRecipeSimulation(line);
            const product = line.source === 'catalog' ? products.find((p) => p.id === line.productId) : null;
            const cost = line.source === 'custom'
              ? getCustomLineUnitCost(line, products, materials)
              : product
              ? getProductUnitCost(product)
              : 0;
            return (
              <ProjectRecipeCard key={line.id} line={line} product={product} products={products} materials={materials}>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-stone-700">
                  <span>
                    {simulation
                      ? `${formatNumber(line.quantity)} un simuladas`
                      : `${formatNumber(line.quantity)} un planejadas · ${formatNumber(line.producedQuantity || 0)} un produzidas`}
                  </span>
                  <strong>{formatCurrency(cost * line.quantity)} no projeto</strong>
                </div>
                {product && line.quantity > (line.producedQuantity || 0) && <p className="text-xs text-stone-500" aria-label={`Etapas atuais de ${product.name}`}>
                  Receita atual: {product.useProductionStages && product.productionStages?.length ? [...product.productionStages].sort((a, b) => a.order - b.order).map(stage => stage.name).join(' → ') : 'Produção direta'}
                </p>}
                {simulation && line.customRecipeItems?.filter(item => item.materialQuote).map(item => (
                  <div key={item.id} className="text-xs text-stone-700">
                    <span className="font-medium">{item.name}</span>
                    <ProjectMaterialQuoteDetails item={item} />
                  </div>
                ))}
              </ProjectRecipeCard>
            );
          })
        )}
      </div>
    </div>

    {(project.directMaterials?.length || 0) > 0 && (
      <div>
        <h4 className="text-xs font-bold text-stone-800 mb-2">Materiais adicionados diretamente ao projeto</h4>
        <div className="space-y-2">
          {(project.directMaterials || []).map((line) => {
            const material = materials.find((m) => m.id === line.materialId);
            const multiplier = line.scope === 'per_unit' ? getProjectPlannedUnits(project) : 1;
            const totalQty = line.quantity * multiplier;
            const unitCost = getProjectMaterialUnitCost(material, materials, products, line.categorySelections);
            return (
              <div key={line.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-stone-900">{material?.name || line.name}</div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    {formatNumber(line.quantity)} {UNIT_SHORT[(material?.unit || line.unit) as keyof typeof UNIT_SHORT] || material?.unit || line.unit}
                    {line.scope === 'per_unit' ? ' por unidade' : ' no projeto'}
                    {line.scope === 'per_unit' ? ` • total ${formatNumber(totalQty)}` : ''}
                  </div>
                  {line.notes && <div className="text-[11px] text-stone-600 mt-1 italic">{line.notes}</div>}
                  {line.categorySelections && <div className="text-[11px] text-purple-700 mt-1">{Object.values(line.categorySelections).map(id => materials.find(material => material.id === id)?.name).filter(Boolean).join(' · ')}</div>}
                </div>
                <div className="text-xs font-semibold text-stone-700 shrink-0">
                  {formatCurrency(totalQty * unitCost)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    <div>
      <h4 className="text-xs font-bold text-stone-800 mb-2">Materiais e subprodutos necessários</h4>
      {requirements.length === 0 ? (
        <p className="text-xs text-stone-500">Adicione produtos ao projeto para calcular as necessidades.</p>
      ) : (
        <div className="overflow-x-auto bg-white border border-stone-200 rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Item</th>
                <th className="text-right font-semibold px-3 py-2">Precisa</th>
                <th className="text-right font-semibold px-3 py-2">Estoque</th>
                <th className="text-right font-semibold px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => {
                const missing = req.available !== undefined ? Math.max(0, req.required - req.available) : 0;
                return (
                  <tr key={req.key} className="border-t border-stone-100">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-stone-800">{req.name}</div>
                      <div className="text-[10px] text-stone-400">
                        {req.type === 'product' ? 'Subproduto' : req.type === 'category' ? 'Escolha variável' : req.type === 'durable' ? 'Item durável / reutilizável' : 'Material'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-stone-800">
                      {formatNumber(req.required)} {UNIT_SHORT[req.unit as keyof typeof UNIT_SHORT] || req.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-stone-600">
                      {req.available === undefined
                        ? '—'
                        : `${formatNumber(req.available)} ${UNIT_SHORT[req.unit as keyof typeof UNIT_SHORT] || req.unit}`}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {req.needsChoice ? (
                        <span className="text-amber-800 font-semibold">Definir na produção</span>
                      ) : missing > 0 ? (
                        <span className="text-rose-700 font-bold">Falta {formatNumber(missing)}</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Suficiente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {(project.notes || project.checklist.length > 0) && (
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold text-stone-800 mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Anotações
          </h4>
          <div className="bg-white border border-stone-200 rounded-xl p-3 text-xs text-stone-600 whitespace-pre-wrap min-h-16">
            {project.notes || 'Sem anotações.'}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold text-stone-800 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Checklist
          </h4>
          <div className="space-y-1.5">
            {project.checklist.map((item) => (
              <div key={item.id} className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                {item.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-stone-300 shrink-0" />
                )}
                <span className={item.completed ? 'line-through text-stone-400' : 'text-stone-700'}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </>
);

const projectPanel = 'min-w-0 rounded-2xl border border-[#e5dad1] bg-white p-4 sm:p-5';

const ProjectEditor = ({
  project,
  products,
  materials,
  onClose,
  onSave,
}: {
  project: ProductionProject;
  products: Product[];
  materials: Material[];
  onClose: () => void;
  onSave: (project: ProductionProject, approvalLineId?: string) => void;
}) => {
  const [draft, setDraft] = useState<ProductionProject>(project);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [catalogQty, setCatalogQty] = useState('1');
  const [selectedProjectMaterial, setSelectedProjectMaterial] = useState<Material | null>(null);
  const [projectMaterialQty, setProjectMaterialQty] = useState('1');
  const [projectMaterialScope, setProjectMaterialScope] = useState<'project' | 'per_unit'>('project');
  const [checkText, setCheckText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [editingLine, setEditingLine] = useState<ProjectProductLine | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const customNameRef = useRef<HTMLInputElement>(null);
  const ingredientEditorRef = useRef<HTMLDivElement>(null);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customYield, setCustomYield] = useState('1');
  const [customSalePrice, setCustomSalePrice] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customItems, setCustomItems] = useState<ProjectRecipeItem[]>([]);
  const [customItemType, setCustomItemType] = useState<'material' | 'product' | 'quote'>('material');
  const [editingIngredient, setEditingIngredient] = useState<ProjectRecipeItem>();
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedSubProduct, setSelectedSubProduct] = useState<Product | null>(null);
  const [customItemQty, setCustomItemQty] = useState('1');
  const [customChoices, setCustomChoices] = useState<Record<string, string>>({});
  const [directChoices, setDirectChoices] = useState<Record<string, string>>({});

  const requirements = useMemo(() => buildRequirements(draft, products, materials), [draft, products, materials]);
  const projectedCost = plannedLines(draft).reduce((sum, line) => {
    if (line.source === 'custom') return sum + getCustomLineUnitCost(line, products, materials) * line.quantity;
    const product = products.find((p) => p.id === line.productId);
    return sum + (product ? getProductUnitCost(product) : 0) * line.quantity;
  }, 0) + getDirectMaterialsCost(draft, materials, products);
  const categories = useMemo(() => [...new Set(materials.map(material => material.category).filter(Boolean))].sort(), [materials]);

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (showCustom) customNameRef.current?.focus();
  }, [showCustom]);

  useEffect(() => {
    if (editingIngredient) ingredientEditorRef.current?.focus();
  }, [editingIngredient]);

  const resetIngredient = () => {
    setCustomItemType('material');
    setEditingIngredient(undefined);
    setSelectedMaterial(null);
    setSelectedSubProduct(null);
    setCustomChoices({});
    setCustomItemQty('1');
  };

  const editCustomLine = (line: ProjectProductLine) => {
    setEditingLine(line);
    setCustomName(line.name);
    setCustomQty(String(line.quantity));
    setCustomYield(String(line.batchYield));
    setCustomSalePrice(line.targetSalePrice ? String(line.targetSalePrice) : '');
    setCustomNotes(line.notes || '');
    setCustomItems(line.customRecipeItems || []);
    resetIngredient();
    setShowCustom(true);
  };

  const resetCustomLine = () => {
    setEditingLine(null);
    setCustomName('');
    setCustomQty('1');
    setCustomYield('1');
    setCustomSalePrice('');
    setCustomNotes('');
    setCustomItems([]);
    resetIngredient();
    setShowCustom(false);
  };

  const editIngredient = (item: ProjectRecipeItem) => {
    setEditingIngredient(item);
    setCustomItemType(item.materialQuote ? 'quote' : item.type);
    setCustomItemQty(String(item.quantity));
    setCustomChoices(item.categorySelections || {});
    setSelectedMaterial(item.type === 'material' && !item.materialQuote ? materials.find(material => material.id === item.targetId) || null : null);
    setSelectedSubProduct(item.type === 'product' ? products.find(product => product.id === item.targetId) || null : null);
  };

  const saveIngredient = (item: ProjectRecipeItem) => {
    setCustomItems(previous => editingIngredient
      ? previous.map(value => value.id === editingIngredient.id ? item : value)
      : [...previous, item]);
    resetIngredient();
  };

  const addProjectMaterial = () => {
    const qty = Number(projectMaterialQty);
    if (!selectedProjectMaterial || !Number.isFinite(qty) || qty <= 0) return;
    let categorySelections: Record<string, string> | undefined;
    try { categorySelections = configuredChoices(selectedProjectMaterial, directChoices, materials, products); }
    catch (error) { alert((error as Error).message); return; }

    setDraft((prev) => {
      const directMaterials = prev.directMaterials || [];
      const existing = directMaterials.find(
        (line) => line.materialId === selectedProjectMaterial.id && line.scope === projectMaterialScope && selectionKey(line.categorySelections) === selectionKey(categorySelections)
      );
      if (existing) {
        return {
          ...prev,
          directMaterials: directMaterials.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + qty } : line
          ),
        };
      }

      const line: ProjectMaterialLine = {
        id: `project_material_${Date.now()}`,
        materialId: selectedProjectMaterial.id,
        name: selectedProjectMaterial.name,
        quantity: qty,
        unit: selectedProjectMaterial.unit,
        scope: projectMaterialScope,
        categorySelections,
      };
      return { ...prev, directMaterials: [...directMaterials, line] };
    });

    setSelectedProjectMaterial(null);
    setProjectMaterialQty('1');
    setDirectChoices({});
  };

  const addCatalogLine = () => {
    const qty = Number(catalogQty);
    if (!selectedProduct || !Number.isFinite(qty) || qty <= 0) return;
    setDraft((prev) => {
      const existing = prev.lines.find((l) => l.source === 'catalog' && l.productId === selectedProduct.id);
      if (existing) {
        return {
          ...prev,
          lines: prev.lines.map((l) =>
            l.id === existing.id ? { ...l, quantity: l.quantity + qty } : l
          ),
        };
      }
      const line: ProjectProductLine = {
        id: `project_line_${crypto.randomUUID()}`,
        source: 'catalog',
        productId: selectedProduct.id,
        name: selectedProduct.name,
        quantity: qty,
        producedQuantity: 0,
        batchYield: selectedProduct.batchYield || 1,
      };
      return { ...prev, lines: [...prev.lines, line] };
    });
    setSelectedProduct(null);
    setCatalogQty('1');
  };

  const addCustomRecipeItem = () => {
    const qty = Number(customItemQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const id = editingIngredient?.id || crypto.randomUUID();

    if (customItemType === 'material' && selectedMaterial) {
      let categorySelections: Record<string, string> | undefined;
      try { categorySelections = configuredChoices(selectedMaterial, customChoices, materials, products); }
      catch (error) { alert((error as Error).message); return; }
      const unitCost = getProjectMaterialUnitCost(selectedMaterial, materials, products, categorySelections);
      saveIngredient({
        id,
        type: 'material',
        targetId: selectedMaterial.id,
        name: selectedMaterial.name,
        quantity: qty,
        unit: selectedMaterial.unit,
        unitCost,
        totalCost: unitCost * qty,
        categorySelections,
        durableOption: selectedMaterial.id === editingIngredient?.targetId ? editingIngredient.durableOption : undefined,
      });
    }

    if (customItemType === 'product' && selectedSubProduct) {
      const unitCost = getProductUnitCost(selectedSubProduct);
      saveIngredient({
        id,
        type: 'product',
        targetId: selectedSubProduct.id,
        name: selectedSubProduct.name,
        quantity: qty,
        unit: 'un',
        unitCost,
        totalCost: unitCost * qty,
      });
    }
  };

  const addCustomLine = () => {
    if (editingIngredient || customItemType === 'quote') {
      alert('Conclua ou cancele a alteração do insumo antes de salvar a receita.');
      return;
    }
    const qty = Number(customQty);
    const yieldQty = Number(customYield);
    const salePrice = customSalePrice ? Number(customSalePrice) : 0;
    if (!customName.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(yieldQty) || yieldQty <= 0) {
      alert('Informe o nome, a quantidade planejada e o rendimento da receita personalizada.');
      return;
    }
    if (customItems.length === 0) {
      alert('Adicione pelo menos um material ou subproduto à receita personalizada.');
      return;
    }

    const line: ProjectProductLine = {
      ...editingLine,
      id: editingLine?.id || crypto.randomUUID(),
      source: 'custom',
      name: customName.trim(),
      quantity: qty,
      producedQuantity: editingLine?.producedQuantity || 0,
      batchYield: yieldQty,
      targetSalePrice: Number.isFinite(salePrice) ? salePrice : 0,
      notes: customNotes.trim() || undefined,
      customRecipeItems: customItems,
      approvedAt: customItems.some(item => item.materialQuote) ? undefined : editingLine?.approvedAt,
    };

    setDraft(prev => ({
      ...prev,
      lines: prev.lines.some(value => value.id === line.id)
        ? prev.lines.map(value => value.id === line.id ? line : value)
        : [...prev.lines, line],
    }));
    resetCustomLine();
  };

  const save = (approvalLine?: ProjectProductLine) => {
    if (!draft.name.trim()) {
      alert('Dê um nome ao projeto.');
      return;
    }
    if (showCustom && (editingLine || customName.trim() || customItems.length > 0 || customItemType === 'quote')) {
      alert('Conclua ou cancele a edição da receita antes de salvar o projeto.');
      return;
    }
    try {
      for (const line of draft.directMaterials || []) {
        const material = materials.find(value => value.id === line.materialId);
        if (material) configuredChoices(material, line.categorySelections || {}, materials, products);
      }
      for (const line of draft.lines.filter(line => line.source === 'custom')) for (const item of line.customRecipeItems || []) {
        const material = item.type === 'material' ? materials.find(value => value.id === item.targetId) : undefined;
        if (material) configuredChoices(material, item.categorySelections || {}, materials, products);
      }
    } catch (error) { alert((error as Error).message); return; }
    if (approvalLine) {
      const materialNotice = approvalLine.customRecipeItems?.some(item => item.materialQuote)
        ? ' Os materiais de teste dessa receita serão cadastrados com os custos informados e estoque inicial zero.'
        : '';
      if (!confirm(`Aprovar "${approvalLine.name}"? A receita entra no planejamento e o projeto será salvo.${materialNotice}`)) return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      updatedAt: today(),
    }, approvalLine?.id);
  };

  return (
    <section aria-labelledby="project-editor-title" className="space-y-5">
      <div className="space-y-2">
        <button type="button" onClick={onClose} className="inline-flex min-h-9 items-center gap-2 rounded-lg pr-2 text-sm font-semibold text-[#8c5441] hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar aos projetos
        </button>
        <h2 id="project-editor-title" tabIndex={-1} ref={headingRef} className="text-2xl font-semibold tracking-tight text-[#352f2b] sm:text-3xl">
          {project.name ? 'Editar projeto' : 'Novo projeto'}
        </h2>
      </div>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <section className={`${projectPanel} space-y-3`} aria-labelledby="project-info-title">
            <h3 id="project-info-title" className="text-base font-semibold text-stone-900">Dados do projeto</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px]">
              <label className="min-w-0 text-xs font-semibold text-stone-700 sm:col-span-2 xl:col-span-1">
                Nome do projeto
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex.: Produção Dia das Mães"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
              <label className="min-w-0 text-xs font-semibold text-stone-700">
                Status
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as ProductionProject['status'] }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900"
                >
                  <option value="planning">Planejamento</option>
                  <option value="in_progress">Em produção</option>
                  <option value="completed">Finalizado</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-semibold text-stone-700">
                Prazo
                <input
                  type="date"
                  value={draft.dueDate || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, dueDate: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900"
                />
              </label>
            </div>
          </section>

          <section className={`${projectPanel} space-y-4`} aria-labelledby="project-recipes-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="project-recipes-title" className="text-lg font-semibold text-stone-900">Receitas do projeto</h3>
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                aria-expanded={showCustom}
                disabled={showCustom}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 text-sm font-semibold text-purple-800 hover:bg-purple-100 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Criar receita personalizada
              </button>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 md:grid-cols-[minmax(0,1fr)_100px_auto]">
              <div className="col-span-2 min-w-0 md:col-span-1">
                <label htmlFor="project-catalog-recipe" className="mb-1 block text-xs font-semibold text-stone-700">Receita do catálogo</label>
                <SearchableProductCombobox
                  id="project-catalog-recipe"
                  products={products.filter((p) => !p.isCustomRecipe)}
                  selectedProductId={selectedProduct?.id || ''}
                  onSelectProduct={setSelectedProduct}
                  placeholder="Buscar uma receita cadastrada..."
                  filterOnlyFinalForSale={false}
                  mode="production"
                />
              </div>
              <label className="min-w-0 text-xs font-semibold text-stone-700">
                Quantidade
                <input
                  aria-label="Quantidade da receita do catálogo"
                  type="number"
                  min="0.01"
                  step="any"
                  value={catalogQty}
                  onChange={(e) => setCatalogQty(e.target.value)}
                  className="mt-1 w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                />
              </label>
              <button
                type="button"
                onClick={addCatalogLine}
                disabled={!selectedProduct || !Number.isFinite(Number(catalogQty)) || Number(catalogQty) <= 0}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#a86149] px-3 text-sm font-semibold text-white hover:bg-[#92533c] disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar receita
              </button>
            </div>

            {showCustom && (
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-4" role="group" aria-label={editingLine ? 'Editar receita personalizada' : 'Nova receita personalizada'}>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="text-[11px] font-semibold text-stone-700 sm:col-span-2">
                    Nome da receita
                    <input
                      ref={customNameRef}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex.: Vela especial da cliente Ana"
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-stone-700">
                    Produzir
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-stone-700">
                    Rende por receita
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={customYield}
                      onChange={(e) => setCustomYield(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                    />
                  </label>
                </div>

                <div ref={ingredientEditorRef} tabIndex={-1} className="scroll-mt-20">
                  {editingIngredient && (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-purple-100 px-3 py-2 text-xs text-purple-950">
                      <strong>Alterar insumo: {editingIngredient.name}</strong>
                      <button type="button" onClick={resetIngredient} className="font-semibold underline">Cancelar alteração do insumo</button>
                    </div>
                  )}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomItemType('material')}
                      aria-pressed={customItemType === 'material'}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${customItemType === 'material' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                    >
                      Material
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomItemType('product')}
                      aria-pressed={customItemType === 'product'}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${customItemType === 'product' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                    >
                      Subproduto
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomItemType('quote')}
                      aria-pressed={customItemType === 'quote'}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${customItemType === 'quote' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                    >
                      Material de teste
                    </button>
                  </div>

                  {customItemType === 'quote' ? (
                    <ProjectSimulatedMaterialForm
                      key={editingIngredient?.id || 'novo'}
                      item={editingIngredient}
                      categories={categories}
                      onAdd={saveIngredient}
                    />
                  ) : <div className="grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-end">
                    {customItemType === 'material' ? (
                      <SearchableMaterialCombobox
                        id="project-custom-material"
                        materials={materials}
                        selectedMaterialId={selectedMaterial?.id || ''}
                        onSelectMaterial={material => { setSelectedMaterial(material); setCustomChoices({}); }}
                        placeholder="Buscar material para a receita..."
                      />
                    ) : (
                      <SearchableProductCombobox
                        products={products.filter((p) => !p.isCustomRecipe)}
                        selectedProductId={selectedSubProduct?.id || ''}
                        onSelectProduct={setSelectedSubProduct}
                        placeholder="Buscar subproduto..."
                        filterOnlyFinalForSale={false}
                        mode="production"
                      />
                    )}
                    <label className="text-[11px] font-semibold text-stone-600">
                      Qtd. por receita
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={customItemQty}
                        onChange={(e) => setCustomItemQty(e.target.value)}
                        className="mt-1 w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addCustomRecipeItem}
                      className="px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-stone-800 text-xs font-semibold hover:bg-stone-50"
                    >
                      {editingIngredient ? 'Atualizar insumo' : '+ Insumo'}
                    </button>
                  </div>}
                  {customItemType === 'material' && <div className="mt-3"><ProjectMaterialChoices id="project-custom-aroma" material={selectedMaterial} materials={materials} choices={customChoices} onChange={setCustomChoices} /></div>}
                </div>

                {customItems.length > 0 && (
                  <div className="space-y-1.5">
                    {customItems.map((item) => (
                      <div key={item.id} className="bg-white border border-stone-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-stone-800 truncate">{item.name}</div>
                          <div className="text-[10px] text-stone-500">
                            {formatNumber(item.quantity)} {UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] || item.unit} por receita
                          </div>
                          <ProjectMaterialQuoteDetails item={item} />
                          {item.categorySelections && <div className="text-[11px] text-purple-700">{Object.values(item.categorySelections).map(id => materials.find(material => material.id === id)?.name).filter(Boolean).join(' · ')}</div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={item.materialQuote ? `Editar cotação de ${item.name}` : `Trocar insumo ${item.name}`}
                            onClick={() => editIngredient(item)}
                            className="flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-purple-800 hover:bg-purple-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {item.materialQuote ? 'Editar' : 'Trocar'}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remover ${item.name} da receita`}
                            onClick={() => {
                              setCustomItems(previous => previous.filter(value => value.id !== item.id));
                              if (editingIngredient?.id === item.id) resetIngredient();
                            }}
                            className="p-2 rounded-lg text-stone-500 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <label className="text-[11px] font-semibold text-stone-700">
                    Preço de venda estimado por unidade (opcional)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customSalePrice}
                      onChange={(e) => setCustomSalePrice(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-stone-700">
                    Observação da receita
                    <input
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="Aroma, cor, acabamento, cliente..."
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-stone-700">
                    Custo estimado por peça <strong>{formatCurrency(getCustomLineUnitCost({
                      customRecipeItems: customItems,
                      batchYield: Math.max(0, Number(customYield)) || 1,
                      recipePricing: editingLine?.recipePricing,
                    }, products, materials))}</strong>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={resetCustomLine} className="px-3 py-2 text-xs font-semibold text-stone-700">
                      Cancelar receita
                    </button>
                    <button
                      type="button"
                      onClick={addCustomLine}
                      className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
                    >
                      {editingLine ? 'Salvar receita no projeto' : 'Adicionar receita personalizada ao projeto'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 border-t border-stone-100 pt-3">
              <h4 className="text-sm font-semibold text-stone-800" aria-live="polite">
                {draft.lines.length} {draft.lines.length === 1 ? 'receita no projeto' : 'receitas no projeto'}
              </h4>
              {draft.lines.length === 0 && <p className="text-sm text-stone-500">Escolha uma receita do catálogo ou crie uma personalizada.</p>}
              <div className="grid gap-4 xl:grid-cols-2">
                {draft.lines.map((line) => {
                  const simulation = isRecipeSimulation(line);
                  const product = line.source === 'catalog' ? products.find((p) => p.id === line.productId) : null;
                  const unitCost = line.source === 'custom'
                    ? getCustomLineUnitCost(line, products, materials)
                    : product
                    ? getProductUnitCost(product)
                    : 0;
                  return (
                    <ProjectRecipeCard key={line.id} line={line} product={product} products={products} materials={materials}>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
                        <span className="text-xs text-stone-600">
                          Custo para {formatNumber(line.quantity)} un <strong>{formatCurrency(unitCost * line.quantity)}</strong>
                        </span>
                        <div className="flex shrink-0 gap-1">
                          {line.source === 'custom' && <button
                            type="button"
                            disabled={showCustom}
                            onClick={() => editCustomLine(line)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-purple-800 hover:bg-purple-100 disabled:opacity-50"
                          >Editar receita</button>}
                          {(product || line.source === 'custom') && (
                            <button type="button" disabled={showCustom}
                              onClick={() => editCustomLine(duplicateProjectRecipe(line, product, draft.lines))}
                              aria-label={`Duplicar receita ${product?.name || line.name}`}
                              title="Duplicar receita para comparar"
                              className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 disabled:opacity-40">
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Remover receita ${product?.name || line.name}`}
                            disabled={editingLine?.id === line.id}
                            onClick={() => setDraft((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== line.id) }))}
                            className="p-1 text-stone-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="min-w-0 text-xs text-stone-600">
                          {simulation ? 'Quantidade simulada' : 'Planejado'}
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => {
                              const value = Math.max(0, Number(e.target.value) || 0);
                              setDraft((prev) => ({
                                ...prev,
                                lines: prev.lines.map((l) => l.id === line.id ? { ...l, quantity: value } : l),
                              }));
                            }}
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-800"
                          />
                        </label>
                        {!simulation && <label className="min-w-0 text-xs text-stone-600">
                          Já produzido
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.producedQuantity || 0}
                            onChange={(e) => {
                              const value = Math.max(0, Number(e.target.value) || 0);
                              setDraft((prev) => ({
                                ...prev,
                                lines: prev.lines.map((l) => l.id === line.id ? { ...l, producedQuantity: value } : l),
                              }));
                            }}
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-800"
                          />
                        </label>}
                      </div>
                      {line.source === 'custom' && (line.customRecipeItems || []).map(item => {
                        if (item.materialQuote) return <div key={item.id} className="mt-2 border-t border-stone-200 pt-2 text-xs text-stone-700">
                          <span className="font-semibold">{item.name}</span>
                          <span> · {formatNumber(item.quantity, 4)} {UNIT_SHORT[item.materialQuote.unit]} por receita</span>
                          <ProjectMaterialQuoteDetails item={item} />
                        </div>;
                        const material = item.type === 'material' ? materials.find(value => value.id === item.targetId) : undefined;
                        return material?.isVirtualRecipe ? <div key={item.id} className="mt-3"><ProjectMaterialChoices id={`project-saved-${line.id}-${item.id}`} material={material} materials={materials} choices={item.categorySelections} onChange={choices => setDraft(previous => ({ ...previous, lines: previous.lines.map(value => value.id === line.id ? { ...value, customRecipeItems: value.customRecipeItems?.map(recipeItem => {
                          if (recipeItem.id !== item.id) return recipeItem;
                          const unitCost = getProjectMaterialUnitCost(material, materials, products, choices);
                          return { ...recipeItem, categorySelections: choices, unitCost, totalCost: recipeItem.quantity * unitCost };
                        }) } : value) }))} /></div> : null;
                      })}
                      {simulation && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-stone-600">Entra no planejamento ao aprovar.</span>
                          <button type="button" onClick={() => save(line)} disabled={showCustom}
                            className="rounded-lg bg-purple-700 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
                            Aprovar receita
                          </button>
                        </div>
                      )}
                    </ProjectRecipeCard>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={`${projectPanel} space-y-4`} aria-labelledby="project-materials-title">
            <div>
              <h3 id="project-materials-title" className="text-base font-semibold text-stone-900">Materiais do projeto</h3>
              <p className="text-[11px] text-stone-500">
                Para embalagens, saquinhos, papéis, etiquetas, fitas e outros materiais que não fazem parte de uma receita.
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_105px_165px_auto] gap-2 items-end">
              <SearchableMaterialCombobox
                id="project-direct-material"
                materials={materials}
                selectedMaterialId={selectedProjectMaterial?.id || ''}
                onSelectMaterial={material => { setSelectedProjectMaterial(material); setDirectChoices({}); }}
                placeholder="Buscar material..."
              />
              <label className="text-[11px] font-semibold text-stone-600">
                Quantidade
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={projectMaterialQty}
                  onChange={(e) => setProjectMaterialQty(e.target.value)}
                  className="mt-1 w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                />
              </label>
              <label className="text-[11px] font-semibold text-stone-600">
                Usar como
                <select
                  value={projectMaterialScope}
                  onChange={(e) => setProjectMaterialScope(e.target.value as 'project' | 'per_unit')}
                  className="mt-1 w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                >
                  <option value="project">Total do projeto</option>
                  <option value="per_unit">Por unidade produzida</option>
                </select>
              </label>
              <button
                type="button"
                onClick={addProjectMaterial}
                disabled={!selectedProjectMaterial}
                className="px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>
            <ProjectMaterialChoices id="project-direct-aroma" material={selectedProjectMaterial} materials={materials} choices={directChoices} onChange={setDirectChoices} />

            {(draft.directMaterials?.length || 0) > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                {(draft.directMaterials || []).map((line) => {
                  const material = materials.find((m) => m.id === line.materialId);
                  const plannedUnits = getProjectPlannedUnits(draft);
                  const totalQty = line.quantity * (line.scope === 'per_unit' ? plannedUnits : 1);
                  const unit = material?.unit || line.unit;
                  const unitCost = getProjectMaterialUnitCost(material, materials, products, line.categorySelections);
                  return (
                    <div key={line.id} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-900">{material?.name || line.name}</div>
                          <div className="text-[10px] text-stone-500 mt-1">
                            Total calculado: {formatNumber(totalQty)} {UNIT_SHORT[unit as keyof typeof UNIT_SHORT] || unit}
                            {' • '}{formatCurrency(totalQty * unitCost)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraft((prev) => ({
                            ...prev,
                            directMaterials: (prev.directMaterials || []).filter((item) => item.id !== line.id),
                          }))}
                          className="p-1 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2 mt-2">
                        <label className="text-[10px] text-stone-500">
                          Quantidade
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => {
                              const value = Math.max(0, Number(e.target.value) || 0);
                              setDraft((prev) => ({
                                ...prev,
                                directMaterials: (prev.directMaterials || []).map((item) =>
                                  item.id === line.id ? { ...item, quantity: value } : item
                                ),
                              }));
                            }}
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-800"
                          />
                        </label>
                        <label className="text-[10px] text-stone-500">
                          Aplicação
                          <select
                            value={line.scope}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                directMaterials: (prev.directMaterials || []).map((item) =>
                                  item.id === line.id
                                    ? { ...item, scope: e.target.value as 'project' | 'per_unit' }
                                    : item
                                ),
                              }))
                            }
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-800"
                          >
                            <option value="project">Total do projeto</option>
                            <option value="per_unit">Por unidade produzida</option>
                          </select>
                        </label>
                      </div>
                      <div className="mt-3"><ProjectMaterialChoices id={`project-direct-saved-${line.id}`} material={material} materials={materials} choices={line.categorySelections} onChange={choices => setDraft(previous => ({ ...previous, directMaterials: previous.directMaterials?.map(value => value.id === line.id ? { ...value, categorySelections: choices } : value) }))} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className={projectPanel} aria-labelledby="project-notes-title">
              <h3 id="project-notes-title" className="mb-2 text-base font-semibold text-stone-900">Anotações</h3>
              <textarea
                aria-labelledby="project-notes-title"
                value={draft.notes || ''}
                onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ideias, fornecedores, detalhes de embalagem, testes, lembretes..."
                rows={7}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </section>

            <section className={projectPanel} aria-labelledby="project-checklist-title">
              <h3 id="project-checklist-title" className="mb-2 text-base font-semibold text-stone-900">Checklist</h3>
              <div className="flex gap-2">
                <input
                  value={checkText}
                  onChange={(e) => setCheckText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const text = checkText.trim();
                      if (!text) return;
                      const item: ProjectChecklistItem = {
                        id: `project_check_${Date.now()}`,
                        text,
                        completed: false,
                      };
                      setDraft((p) => ({ ...p, checklist: [...p.checklist, item] }));
                      setCheckText('');
                    }
                  }}
                  placeholder="Ex.: imprimir rótulos"
                  aria-label="Novo item do checklist"
                  className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const text = checkText.trim();
                    if (!text) return;
                    setDraft((p) => ({
                      ...p,
                      checklist: [...p.checklist, { id: `project_check_${Date.now()}`, text, completed: false }],
                    }));
                    setCheckText('');
                  }}
                  className="px-3 py-2 rounded-xl bg-stone-100 border border-stone-200 text-xs font-semibold"
                >
                  Adicionar
                </button>
              </div>
              <div className="space-y-1.5 mt-3">
                {draft.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          checklist: p.checklist.map((x) => x.id === item.id ? { ...x, completed: !x.completed } : x),
                        }))
                      }
                      className="shrink-0"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-stone-300" />
                      )}
                    </button>
                    <span className={`text-xs flex-1 ${item.completed ? 'line-through text-stone-400' : 'text-stone-700'}`}>{item.text}</span>
                    <button
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, checklist: p.checklist.filter((x) => x.id !== item.id) }))}
                      className="p-1 text-stone-400 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside aria-labelledby="project-summary-title" className={`${projectPanel} space-y-4`}>
          <h3 id="project-summary-title" className="text-base font-semibold text-stone-900">Resumo do planejamento</h3>
          <dl className="space-y-2 rounded-xl bg-[#f8f4ef] p-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-stone-600">Unidades planejadas</dt>
              <dd className="font-semibold">{formatNumber(getProjectPlannedUnits(draft))}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="font-semibold text-stone-800">Custo previsto</dt>
              <dd className="font-bold">{formatCurrency(projectedCost)}</dd>
            </div>
          </dl>
          {requirements.length === 0 ? (
            <p className="text-xs text-stone-500">Adicione receitas para ver os insumos necessários.</p>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-stone-800">Insumos necessários</h4>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {requirements.map(req => {
                  const missing = req.available !== undefined && req.required > req.available + 0.000001;
                  return (
                    <li key={req.key} className={`min-w-0 rounded-lg border px-3 py-2 ${missing ? 'border-rose-200 bg-rose-50' : 'border-stone-200 bg-stone-50'}`}>
                      <div className="break-words text-xs font-semibold text-stone-800">{req.name}</div>
                      <div className="mt-0.5 text-xs text-stone-500">
                        {formatNumber(req.required)} {UNIT_SHORT[req.unit as keyof typeof UNIT_SHORT] || req.unit}
                        {req.available !== undefined ? ` · estoque ${formatNumber(req.available)}` : ''}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-end gap-2 rounded-xl border border-[#e5dad1] bg-white p-2.5 shadow-sm">
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-4 text-sm font-medium text-stone-600 hover:bg-stone-100">
          Cancelar
        </button>
        <button type="button" onClick={() => save()} className="min-h-10 rounded-xl bg-[#a86149] px-5 text-sm font-semibold text-white hover:bg-[#92533c]">
          Salvar Projeto
        </button>
      </div>
    </section>
  );
};
