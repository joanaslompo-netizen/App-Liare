import React, { useMemo, useState } from 'react';
import {
  Plus,
  ClipboardList,
  CalendarDays,
  CheckCircle2,
  Circle,
  Edit2,
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
  ProjectProductLine,
  RecipeItem,
} from '../types';
import { formatCurrency, formatNumber, UNIT_SHORT } from '../utils/formatters';
import { SearchableProductCombobox } from './SearchableProductCombobox';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';

interface ProjectsViewProps {
  projects: ProductionProject[];
  products: Product[];
  materials: Material[];
  onSaveProject: (project: ProductionProject) => void;
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

const getCustomLineUnitCost = (
  line: ProjectProductLine,
  products: Product[],
  materials: Material[]
) => {
  const yieldQty = Math.max(0.0001, line.batchYield || 1);
  const batchCost = (line.customRecipeItems || []).reduce((sum, item) => {
    if (item.type === 'material') {
      const material = materials.find((m) => m.id === item.targetId);
      if (material?.usageType === 'durable') return sum;
      return sum + item.quantity * (material?.unitCost ?? item.unitCost ?? 0);
    }
    const product = products.find((p) => p.id === item.targetId);
    return sum + item.quantity * (product ? getProductUnitCost(product) : item.unitCost || 0);
  }, 0);
  return batchCost / yieldQty;
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

  const addRecipeItem = (item: RecipeItem, multiplier: number, visitedVirtual = new Set<string>()) => {
    if (item.type === 'material') {
      if (item.selectionMode === 'category' && item.targetCategory) {
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
        material.recipeItems.forEach((child) => addRecipeItem(child, virtualMultiplier, nextVisited));
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

  project.lines.forEach((line) => {
    if (line.quantity <= 0) return;
    const recipe = getLineRecipe(line, products);
    const multiplier = line.quantity / Math.max(0.0001, recipe.batchYield || 1);
    recipe.items.forEach((item) => addRecipeItem(item, multiplier));
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openNew = () => {
    const now = today();
    setEditingProject({
      id: `project_${Date.now()}`,
      name: '',
      status: 'planning',
      notes: '',
      dueDate: '',
      lines: [],
      checklist: [],
      createdAt: now,
      updatedAt: now,
    });
    setIsModalOpen(true);
  };

  const openEdit = (project: ProductionProject) => {
    setEditingProject(JSON.parse(JSON.stringify(project)));
    setIsModalOpen(true);
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
            const planned = project.lines.reduce((sum, line) => sum + Math.max(0, line.quantity || 0), 0);
            const produced = project.lines.reduce(
              (sum, line) => sum + Math.min(Math.max(0, line.producedQuantity || 0), Math.max(0, line.quantity || 0)),
              0
            );
            const progress = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0;
            const requirements = buildRequirements(project, products, materials);
            const missingCount = requirements.filter(
              (r) => r.available !== undefined && r.required > r.available + 0.000001
            ).length;
            const projectedCost = project.lines.reduce((sum, line) => {
              if (line.source === 'custom') {
                return sum + getCustomLineUnitCost(line, products, materials) * line.quantity;
              }
              const product = products.find((p) => p.id === line.productId);
              return sum + (product ? getProductUnitCost(product) : 0) * line.quantity;
            }, 0);
            const projectedRevenue = project.lines.reduce((sum, line) => {
              if (line.source === 'custom') return sum + (line.targetSalePrice || 0) * line.quantity;
              const product = products.find((p) => p.id === line.productId);
              return sum + (product?.actualPrice || 0) * line.quantity;
            }, 0);
            const expanded = expandedId === project.id;

            return (
              <div key={project.id} className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
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
                        <span>{project.lines.length} {project.lines.length === 1 ? 'item' : 'itens'}</span>
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
                        onClick={() => openEdit(project)}
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
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && editingProject && (
        <ProjectModal
          project={editingProject}
          products={products}
          materials={materials}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProject(null);
          }}
          onSave={(project) => {
            onSaveProject(project);
            setIsModalOpen(false);
            setEditingProject(null);
          }}
        />
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
      <h4 className="text-xs font-bold text-stone-800 mb-2">Produção planejada</h4>
      <div className="space-y-2">
        {project.lines.length === 0 ? (
          <p className="text-xs text-stone-500">Nenhum produto adicionado.</p>
        ) : (
          project.lines.map((line) => {
            const product = line.source === 'catalog' ? products.find((p) => p.id === line.productId) : null;
            const cost = line.source === 'custom'
              ? getCustomLineUnitCost(line, products, materials)
              : product
              ? getProductUnitCost(product)
              : 0;
            return (
              <div key={line.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-900">{line.name}</span>
                    {line.source === 'custom' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                        Receita do projeto
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    {formatNumber(line.quantity)} un planejadas • {formatNumber(line.producedQuantity || 0)} un produzidas • custo est. {formatCurrency(cost)}/un
                  </div>
                  {line.notes && <div className="text-[11px] text-stone-600 mt-1 italic">{line.notes}</div>}
                </div>
                <div className="text-xs font-semibold text-stone-700 shrink-0">
                  {formatCurrency(cost * line.quantity)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>

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

const ProjectModal = ({
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
  onSave: (project: ProductionProject) => void;
}) => {
  const [draft, setDraft] = useState<ProductionProject>(project);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [catalogQty, setCatalogQty] = useState('1');
  const [checkText, setCheckText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customYield, setCustomYield] = useState('1');
  const [customSalePrice, setCustomSalePrice] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customItems, setCustomItems] = useState<RecipeItem[]>([]);
  const [customItemType, setCustomItemType] = useState<'material' | 'product'>('material');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedSubProduct, setSelectedSubProduct] = useState<Product | null>(null);
  const [customItemQty, setCustomItemQty] = useState('1');

  const requirements = useMemo(() => buildRequirements(draft, products, materials), [draft, products, materials]);
  const projectedCost = draft.lines.reduce((sum, line) => {
    if (line.source === 'custom') return sum + getCustomLineUnitCost(line, products, materials) * line.quantity;
    const product = products.find((p) => p.id === line.productId);
    return sum + (product ? getProductUnitCost(product) : 0) * line.quantity;
  }, 0);

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
        id: `project_line_${Date.now()}`,
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

    if (customItemType === 'material' && selectedMaterial) {
      setCustomItems((prev) => [
        ...prev,
        {
          id: `project_recipe_item_${Date.now()}`,
          type: 'material',
          targetId: selectedMaterial.id,
          name: selectedMaterial.name,
          quantity: qty,
          unit: selectedMaterial.unit,
          unitCost: selectedMaterial.usageType === 'durable' ? 0 : selectedMaterial.unitCost,
          totalCost: selectedMaterial.usageType === 'durable' ? 0 : selectedMaterial.unitCost * qty,
        },
      ]);
      setSelectedMaterial(null);
      setCustomItemQty('1');
      return;
    }

    if (customItemType === 'product' && selectedSubProduct) {
      const unitCost = getProductUnitCost(selectedSubProduct);
      setCustomItems((prev) => [
        ...prev,
        {
          id: `project_recipe_item_${Date.now()}`,
          type: 'product',
          targetId: selectedSubProduct.id,
          name: selectedSubProduct.name,
          quantity: qty,
          unit: 'un',
          unitCost,
          totalCost: unitCost * qty,
        },
      ]);
      setSelectedSubProduct(null);
      setCustomItemQty('1');
    }
  };

  const addCustomLine = () => {
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
      id: `project_line_${Date.now()}`,
      source: 'custom',
      name: customName.trim(),
      quantity: qty,
      producedQuantity: 0,
      batchYield: yieldQty,
      targetSalePrice: Number.isFinite(salePrice) ? salePrice : 0,
      notes: customNotes.trim() || undefined,
      customRecipeItems: customItems,
    };

    setDraft((prev) => ({ ...prev, lines: [...prev.lines, line] }));
    setCustomName('');
    setCustomQty('1');
    setCustomYield('1');
    setCustomSalePrice('');
    setCustomNotes('');
    setCustomItems([]);
    setShowCustom(false);
  };

  const save = () => {
    if (!draft.name.trim()) {
      alert('Dê um nome ao projeto.');
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      updatedAt: today(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/65 backdrop-blur-xs flex items-start justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#fbf8f4] w-full max-w-5xl rounded-2xl shadow-2xl border border-stone-200 my-3 overflow-hidden">
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">{project.name ? 'Editar Projeto' : 'Novo Projeto'}</h3>
            <p className="text-xs text-stone-400 mt-0.5">Planejamento não movimenta estoque.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-[1fr_190px_190px] gap-3">
            <label className="text-xs font-semibold text-stone-700">
              Nome do projeto
              <input
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Produção Dia das Mães"
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
            <label className="text-xs font-semibold text-stone-700">
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
            <label className="text-xs font-semibold text-stone-700">
              Prazo
              <input
                type="date"
                value={draft.dueDate || ''}
                onChange={(e) => setDraft((p) => ({ ...p, dueDate: e.target.value }))}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900"
              />
            </label>
          </div>

          <section className="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-stone-900">Produtos e receitas</h4>
                <p className="text-[11px] text-stone-500">Misture receitas do catálogo com receitas exclusivas deste projeto.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustom((v) => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Receita personalizada
              </button>
            </div>

            <div className="grid md:grid-cols-[1fr_110px_auto] gap-2 items-end">
              <SearchableProductCombobox
                products={products.filter((p) => !p.isCustomRecipe)}
                selectedProductId={selectedProduct?.id || ''}
                onSelectProduct={setSelectedProduct}
                placeholder="Buscar uma receita cadastrada..."
                filterOnlyFinalForSale={false}
                mode="production"
              />
              <label className="text-[11px] font-semibold text-stone-600">
                Quantidade
                <input
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
                disabled={!selectedProduct}
                className="px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>

            {showCustom && (
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="text-[11px] font-semibold text-stone-700 sm:col-span-2">
                    Nome da receita
                    <input
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

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setCustomItemType('material')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${customItemType === 'material' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                    >
                      Material
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomItemType('product')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${customItemType === 'product' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                    >
                      Subproduto
                    </button>
                  </div>

                  <div className="grid md:grid-cols-[1fr_110px_auto] gap-2 items-end">
                    {customItemType === 'material' ? (
                      <SearchableMaterialCombobox
                        materials={materials}
                        selectedMaterialId={selectedMaterial?.id || ''}
                        onSelectMaterial={setSelectedMaterial}
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
                      + Insumo
                    </button>
                  </div>
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
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomItems((prev) => prev.filter((x) => x.id !== item.id))}
                          className="p-1 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addCustomLine}
                    className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
                  >
                    Adicionar receita personalizada ao projeto
                  </button>
                </div>
              </div>
            )}

            {draft.lines.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                {draft.lines.map((line) => {
                  const product = line.source === 'catalog' ? products.find((p) => p.id === line.productId) : null;
                  const unitCost = line.source === 'custom'
                    ? getCustomLineUnitCost(line, products, materials)
                    : product
                    ? getProductUnitCost(product)
                    : 0;
                  return (
                    <div key={line.id} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-stone-900">{line.name}</span>
                            {line.source === 'custom' && (
                              <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 rounded-full px-1.5 py-0.5 font-semibold">
                                Personalizada
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-500 mt-1">
                            Custo estimado {formatCurrency(unitCost)}/un
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== line.id) }))}
                          className="p-1 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <label className="text-[10px] text-stone-500">
                          Planejado
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
                        <label className="text-[10px] text-stone-500">
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
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <h4 className="text-sm font-bold text-stone-900 mb-2">Anotações</h4>
              <textarea
                value={draft.notes || ''}
                onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ideias, fornecedores, detalhes de embalagem, testes, lembretes..."
                rows={7}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <h4 className="text-sm font-bold text-stone-900 mb-2">Checklist</h4>
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
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
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
            </div>
          </section>

          <section className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-stone-900">Resumo do planejamento</h4>
                <p className="text-[11px] text-stone-500">Atualizado automaticamente pelas receitas e quantidades acima.</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-500 block">Custo previsto</span>
                <span className="text-sm font-bold text-stone-900">{formatCurrency(projectedCost)}</span>
              </div>
            </div>
            {requirements.length === 0 ? (
              <p className="text-xs text-stone-500">Adicione produtos para ver os materiais necessários.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {requirements.slice(0, 12).map((req) => {
                  const missing = req.available !== undefined && req.required > req.available + 0.000001;
                  return (
                    <div key={req.key} className={`rounded-lg border px-3 py-2 ${missing ? 'border-rose-200 bg-rose-50' : 'border-stone-200 bg-stone-50'}`}>
                      <div className="text-[11px] font-semibold text-stone-800 truncate">{req.name}</div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        {formatNumber(req.required)} {UNIT_SHORT[req.unit as keyof typeof UNIT_SHORT] || req.unit}
                        {req.available !== undefined ? ` • estoque ${formatNumber(req.available)}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-stone-200 p-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100">
            Cancelar
          </button>
          <button type="button" onClick={save} className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold">
            Salvar Projeto
          </button>
        </div>
      </div>
    </div>
  );
};
