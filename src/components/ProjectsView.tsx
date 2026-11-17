import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  ClipboardList,
  CheckCircle2,
  Circle,
  Edit2,
  Copy,
  Trash2,
  X,
  Sparkles,
  ChevronRight,
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
import { formatCurrency, formatDate, formatNumber, formatPercent, UNIT_SHORT } from '../utils/formatters';
import { SearchableProductCombobox } from './SearchableProductCombobox';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';
import { ProjectMaterialQuoteDetails, ProjectSimulatedMaterialForm } from './ProjectSimulatedMaterialForm';
import { RecipeCard } from './RecipeCard';
import { RecipeCostSummary } from './RecipeCostSummary';
import { ProjectAnalysis, ProjectEstimate, type ProjectOverviewRow } from './ProjectOverview';
import { localDateString } from '../utils/localDate';
import { calculateRecipePricing, getCatalogRecipeFinancials, getRecipeCostSummary } from '../utils/financials';
import { getEmbeddedRecipeLaborCost } from '../utils/storage';
import { duplicateProjectRecipe, isRecipeSimulation } from '../utils/projectSimulation';
import { expandVirtualRecipeItems, getCategoryMaterialOptions, getVirtualMaterialRequirements, materialRecipeCosts } from '../utils/virtualMaterials';

interface ProjectsViewProps {
  projects: ProductionProject[];
  products: Product[];
  materials: Material[];
  onSaveProject: (project: ProductionProject, approvalLineId?: string) => ProductionProject | false;
  onDeleteProject: (id: string) => void;
}

type Requirement = {
  key: string;
  type: 'material' | 'product' | 'category' | 'durable';
  name: string;
  unit: string;
  required: number;
};

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
      <SearchableMaterialCombobox showInventory={false} id={`${id}-${index}`} materials={getCategoryMaterialOptions(materials, requirement.category, requirement.unit, requirement.ancestors)} selectedMaterialId={choices?.[requirement.recipeItemId] || ''} onSelectMaterial={selected => onChange({ ...choices, [requirement.recipeItemId]: selected?.id || '' })} placeholder={`Escolha um material de ${requirement.category}...`} />
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

const getLineFinancials = (line: ProjectProductLine, product: Product | null | undefined, products: Product[], materials: Material[]) =>
  product ? getCatalogRecipeFinancials(product) : line.source === 'custom' ? getCustomLineFinancials(line, products, materials) : undefined;

function ProjectRecipeCard({ line, product, products, materials, children }: {
  key?: string;
  line: ProjectProductLine;
  product?: Product | null;
  products: Product[];
  materials: Material[];
  children: React.ReactNode;
}) {
  const financials = getLineFinancials(line, product, products, materials);
  const cost = financials && getRecipeCostSummary({ ...financials, salePrice: financials.salePrice ?? 0 });
  const recipe = {
    name: product?.name || line.name,
    items: product?.items || line.customRecipeItems || [],
    batchYield: product?.batchYield || line.batchYield,
    imageUrl: product?.imageUrl,
  };
  const badge = isRecipeSimulation(line) ? 'Simulação' : line.approvedAt ? 'Aprovada' : undefined;

  return (
    <RecipeCard recipe={recipe} badge={badge} groupLabel={recipe.name} heading="h4" compactHeader>
      {cost && financials ? (
        <div className="px-4 sm:px-5">
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-[#f8f3ee] p-3">
            <div><dt className="text-xs text-stone-600">Custo por un.</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{formatCurrency(cost.total)}</dd></div>
            <div><dt className="text-xs text-stone-600">Venda por un.</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{financials.salePrice == null ? 'A definir' : formatCurrency(financials.salePrice)}</dd></div>
            <div><dt className="text-xs text-stone-600">Margem</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{cost.marginPercent == null ? '—' : formatPercent(cost.marginPercent)}</dd></div>
          </dl>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer py-2 text-xs font-semibold text-[#774936]">Análise financeira</summary>
            <RecipeCostSummary {...financials} />
          </details>
        </div>
      ) : <p className="px-4 text-xs text-stone-600">Receita do catálogo indisponível.</p>}
      <div className="space-y-3 p-4 sm:px-5">
        {children}
      </div>
    </RecipeCard>
  );
}

const budgetLines = (project: ProductionProject) => project.lines.filter(line => !isRecipeSimulation(line) && !line.excludedFromBudget);

const getBudgetUnits = (project: ProductionProject) =>
  budgetLines(project).reduce((sum, line) => sum + Math.max(0, line.quantity || 0), 0);

const getDirectMaterialsCost = (
  project: ProductionProject,
  materials: Material[],
  products: Product[]
) => {
  const plannedUnits = getBudgetUnits(project);
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
): { items: RecipeItem[]; batchYield: number } => {
  if (line.source === 'custom') {
    return {
      items: line.customRecipeItems || [],
      batchYield: line.batchYield || 1,
    };
  }

  const product = products.find((p) => p.id === line.productId);
  return {
    items: product?.items || [],
    batchYield: product?.batchYield || 1,
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
        });
        return;
      }

      const material = materials.find((m) => m.id === item.targetId);

      if (material?.usageType === 'durable') {
        add({
          key: `durable:${item.targetId}:${item.durableOption || ''}`,
          type: 'durable',
          name: item.durableOption ? `${material.name} — ${item.durableOption}` : material.name,
          unit: 'un',
          required: Math.max(1, item.quantity || 1),
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
        name: material?.name || item.name,
        unit: material?.unit || item.unit,
        required: item.quantity * multiplier,
      });
      return;
    }

    const product = products.find((p) => p.id === item.targetId);
    add({
      key: `product:${item.targetId}`,
      type: 'product',
      name: product?.name || item.name,
      unit: 'un',
      required: item.quantity * multiplier,
    });
  };

  budgetLines(project).forEach((line) => {
    if (line.quantity <= 0) return;
    const recipe = getLineRecipe(line, products);
    const multiplier = line.quantity / Math.max(0.0001, recipe.batchYield || 1);
    recipe.items.forEach((item) => addRecipeItem(item, multiplier));
  });

  const plannedUnits = getBudgetUnits(project);
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

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
};

const statusLabels: Record<ProductionProject['status'], string> = {
  planning: 'Rascunho',
  in_progress: 'Em análise',
  completed: 'Concluído',
};

const projectPanel = 'min-w-0 rounded-2xl border border-[#e7dcd2] bg-white p-4 sm:p-5';
const primaryAction = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#8f4c39] px-4 text-sm font-semibold text-white hover:bg-[#773d2e] disabled:opacity-50';
const secondaryAction = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e7dcd2] bg-white px-3 text-sm font-semibold text-[#5e473c] hover:bg-[#f9f4ee] disabled:opacity-50';

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  products,
  materials,
  onSaveProject,
  onDeleteProject,
}) => {
  const [editingProject, setEditingProject] = useState<ProductionProject | null>(null);
  const ordered = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects],
  );

  const openNew = () => {
    const now = localDateString();
    setEditingProject({
      id: `project_${crypto.randomUUID()}`,
      name: '',
      status: 'planning',
      lines: [],
      directMaterials: [],
      checklist: [],
      createdAt: now,
      updatedAt: now,
    });
  };

  if (editingProject) {
    return (
      <ProjectEditor
        project={editingProject}
        products={products}
        materials={materials}
        onSave={onSaveProject}
        onClose={() => {
          setEditingProject(null);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <section aria-labelledby="projects-title" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="projects-title" className="text-3xl font-semibold tracking-tight text-[#352f2b]">Projetos</h2>
          <p className="mt-1 text-sm text-stone-600">Monte receitas, compare alternativas e organize orçamentos.</p>
        </div>
        <button type="button" onClick={openNew} className={primaryAction}>
          <Plus className="size-4" aria-hidden="true" /> Novo Projeto
        </button>
      </header>
      {ordered.length === 0 ? (
        <div className={`${projectPanel} py-10 text-center`}>
          <ClipboardList className="mx-auto size-6 text-[#8f4c39]" aria-hidden="true" />
          <p className="mt-3 font-semibold">Seus projetos aparecem aqui</p>
          <p className="mt-1 text-sm text-stone-600">Crie um projeto para reunir suas receitas e simulações.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#eee5dd] rounded-2xl border border-[#e7dcd2] bg-white">
          {ordered.map(project => (
            <article key={project.id} aria-label={project.name} className="flex min-w-0 items-center gap-2">
              <button type="button" onClick={() => setEditingProject(project)} className="flex min-h-20 min-w-0 flex-1 items-center justify-between gap-3 p-4 text-left hover:bg-[#fbf7f2] sm:px-5">
                <span className="min-w-0">
                  <span className="block break-words text-base font-semibold text-[#352f2b]">{project.name || 'Projeto sem nome'}</span>
                  <span className="mt-1 block text-xs text-stone-600">
                    {project.lines.length} {project.lines.length === 1 ? 'receita' : 'receitas'}
                    {project.dueDate && ` · Prazo ${formatDate(project.dueDate)}`}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[#8f4c39]" aria-hidden="true" />
              </button>
              <button type="button" aria-label={`Excluir projeto ${project.name}`} className="mr-3 shrink-0 rounded-lg p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => { if (confirm(`Excluir o projeto "${project.name}"?`)) onDeleteProject(project.id); }}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

const sections = [
  { id: 'recipes', title: 'Receitas' },
  { id: 'analysis', title: 'Análise' },
  { id: 'estimate', title: 'Orçamento' },
  { id: 'details', title: 'Dados' },
] as const;

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
  onSave: ProjectsViewProps['onSaveProject'];
}) => {
  const [draft, setDraft] = useState<ProductionProject>(project);
  const lastSaved = useRef(project);
  const [saveMessage, setSaveMessage] = useState('');
  const [section, setSection] = useState<(typeof sections)[number]['id']>('recipes');
  const [showCatalog, setShowCatalog] = useState(false);
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
  const additionalCost = getDirectMaterialsCost(draft, materials, products);
  const recipeRows: ProjectOverviewRow[] = draft.lines.map(line => {
    const product = line.source === 'catalog' ? products.find(value => value.id === line.productId) : undefined;
    const financials = getLineFinancials(line, product, products, materials);
    const metrics = financials && getRecipeCostSummary({ ...financials, salePrice: financials.salePrice ?? 0 });
    return {
      id: line.id,
      name: product?.name || line.name,
      quantity: line.quantity,
      unitCost: product ? getProductUnitCost(product) : metrics?.total ?? 0,
      salePrice: financials?.salePrice,
      profit: financials?.salePrice != null ? metrics?.profit : undefined,
      margin: metrics?.marginPercent,
      simulation: isRecipeSimulation(line),
      included: !line.excludedFromBudget,
    };
  });
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
    setShowCatalog(false);
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
      alert('Informe o nome, a quantidade e o rendimento da receita.');
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
      setSection('recipes');
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
      if (!confirm(`Aprovar "${approvalLine.name}"? A receita entra no orçamento e o projeto será salvo.${materialNotice}`)) return;
    }
    const saved = onSave({
      ...draft,
      name: draft.name.trim(),
      updatedAt: localDateString(),
    }, approvalLine?.id);
    if (saved) {
      lastSaved.current = saved;
      setDraft(saved);
      setSaveMessage(approvalLine ? 'Receita aprovada' : 'Projeto salvo');
    }
  };

  const leaveProject = () => {
    const editingContent = draft !== lastSaved.current || (showCustom && (editingLine || customName || customItems.length > 0));
    if (!editingContent || confirm('Sair sem salvar as alterações deste projeto?')) onClose();
  };

  return (
    <section aria-labelledby="project-editor-title" className="space-y-5">
      <div>
        <button type="button" onClick={leaveProject} className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#8f4c39] hover:text-stone-900">
          <ArrowLeft className="size-4" aria-hidden="true" /> Voltar aos projetos
        </button>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 id="project-editor-title" tabIndex={-1} ref={headingRef} className="min-w-0 break-words text-3xl font-semibold tracking-tight text-[#352f2b]">
            {lastSaved.current.name || 'Novo projeto'}
          </h2>
          <div className="flex items-center gap-3">
            {saveMessage && draft === lastSaved.current && <p role="status" className="text-xs font-semibold text-emerald-800">{saveMessage}</p>}
            <button type="button" onClick={() => save()} className={primaryAction}>Salvar Projeto</button>
          </div>
        </div>
        {!lastSaved.current.name && (
          <label className="mt-3 block max-w-md text-xs font-semibold text-stone-700">
            Nome do projeto
            <input value={draft.name} onChange={e => setDraft(previous => ({ ...previous, name: e.target.value }))}
              placeholder="Ex.: Kit de Natal" className="mt-1 block min-h-10 w-full rounded-xl border border-[#e7dcd2] bg-white px-3 text-base font-normal" />
          </label>
        )}
      </div>

      <nav aria-label="Seções do projeto" className="grid grid-cols-4 border-b border-[#e7dcd2] sm:flex sm:gap-4">
        {sections.map(({ id, title }) => (
          <button key={id} type="button" aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}
            className={`min-h-11 border-b-2 px-1 text-center text-sm font-semibold sm:px-3 ${section === id ? 'border-[#8f4c39] text-[#8f4c39]' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
            {title}
          </button>
        ))}
      </nav>

      <div hidden={section !== 'recipes'} className="space-y-4">
        <section className="space-y-4" aria-labelledby="project-recipes-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="project-recipes-title" className="text-xl font-semibold text-[#352f2b]">Receitas do projeto</h3>
              {draft.lines.length > 0 && <p className="mt-1 text-sm text-stone-600">{draft.lines.length} {draft.lines.length === 1 ? 'receita no projeto' : 'receitas no projeto'}</p>}
            </div>
            {!showCustom && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryAction} aria-expanded={showCatalog} onClick={() => setShowCatalog(!showCatalog)}>
                  {showCatalog ? 'Fechar catálogo' : 'Adicionar do catálogo'}
                </button>
                <button type="button" className={primaryAction} onClick={() => { setShowCatalog(false); setShowCustom(true); }}>
                  <Plus className="size-4" aria-hidden="true" /> Criar receita personalizada
                </button>
              </div>
            )}
          </div>

          {showCatalog && (
          <div className={`${projectPanel} grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 md:grid-cols-[minmax(0,1fr)_110px_auto]`}>
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
                      showInventory={false}
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
          )}

          {showCustom && (
            <div className={`${projectPanel} space-y-4`} role="group" aria-label={editingLine ? 'Editar receita personalizada' : 'Nova receita personalizada'}>
              <h4 className="text-base font-semibold">{editingLine ? 'Editar receita' : 'Nova receita'}</h4>
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
                  Quantidade para cálculo
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
                      showInventory={false}
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
                      showInventory={false}
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

          {!showCustom && draft.lines.length === 0 && (
            <p className={`${projectPanel} text-sm text-stone-600`}>Adicione uma receita do catálogo ou crie uma receita para este projeto.</p>
          )}
          {!showCustom && draft.lines.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
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
                    <div className="grid grid-cols-1 gap-2">
                      <label className="min-w-0 text-xs text-stone-600">
                        {simulation ? 'Quantidade simulada' : 'Quantidade para orçamento'}
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
                        <span className="text-[11px] text-stone-600">Entra no orçamento após a aprovação.</span>
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
          )}
        </section>

      </div>

      {section === 'analysis' && <ProjectAnalysis rows={recipeRows} />}

      {section === 'estimate' && (
        <ProjectEstimate rows={recipeRows} additionalCost={additionalCost} onInclude={(id, included) => setDraft(previous => ({
          ...previous,
          lines: previous.lines.map(line => line.id === id ? { ...line, excludedFromBudget: !included || undefined } : line),
        }))}>
          <details className={projectPanel}>
            <summary className="cursor-pointer text-sm font-semibold">Insumos do orçamento</summary>
            {requirements.length === 0 ? <p className="mt-3 text-sm text-stone-600">As quantidades aparecem ao incluir receitas no orçamento.</p> : (
              <ul className="mt-3 divide-y divide-[#eee5dd]" aria-label="Insumos do orçamento">
                {requirements.map(req => (
                  <li key={req.key} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 break-words">{req.name}</span>
                    <span className="shrink-0 text-stone-600">{formatNumber(req.required, 4)} {UNIT_SHORT[req.unit as keyof typeof UNIT_SHORT] || req.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <details className={projectPanel}>
            <summary className="cursor-pointer text-sm font-semibold">Materiais adicionais</summary>
            <section className="mt-4 space-y-4" aria-label="Materiais do projeto">
              <p className="text-sm text-stone-600">Inclua embalagens ou outros materiais usados no orçamento.</p>

              <div className="grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_105px_165px_auto] gap-2 items-end">
                <SearchableMaterialCombobox
                  showInventory={false}
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
                    <option value="per_unit">Por unidade do orçamento</option>
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
                    const plannedUnits = getBudgetUnits(draft);
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
                              <option value="per_unit">Por unidade do orçamento</option>
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
          </details>
        </ProjectEstimate>
      )}

      {section === 'details' && (
        <div className="space-y-4">
          <section className={`${projectPanel} space-y-3`} aria-labelledby="project-info-title">
            <h3 id="project-info-title" className="text-base font-semibold text-stone-900">Dados do projeto</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px]">
              {lastSaved.current.name && <label className="min-w-0 text-xs font-semibold text-stone-700 sm:col-span-2 xl:col-span-1">
                Nome do projeto
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex.: Kit de Natal"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>}
              <label className="min-w-0 text-xs font-semibold text-stone-700">
                Status
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as ProductionProject['status'] }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900"
                >
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
      )}
    </section>
  );
};
