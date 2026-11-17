import type { ReactNode } from 'react';
import { Clock, Image as ImageIcon, Layers, Sparkles, Tag } from 'lucide-react';
import type { Product } from '../types';
import { RecipeCostSummary, type RecipeCostSummaryProps } from './RecipeCostSummary';

type RecipeCardIdentity = Pick<Product, 'name' | 'items' | 'batchYield'> & Partial<Pick<Product,
  'category' | 'productFamily' | 'fragrance' | 'imageUrl' | 'description' | 'notes'
  | 'isCustomRecipe' | 'isPaused' | 'isIntermediate' | 'sourceCustomerName' | 'productionTimeMinutes'
>>;

export function RecipeCard({ recipe: p, financials, badge, groupLabel, heading: Heading = 'h3', id, children, footer, compactHeader }: {
  key?: string;
  recipe: RecipeCardIdentity;
  financials?: RecipeCostSummaryProps;
  badge?: string;
  groupLabel?: string;
  heading?: 'h3' | 'h4';
  id?: string;
  children?: ReactNode;
  footer?: ReactNode;
  compactHeader?: boolean;
}) {
  const materialItemsCount = p.items.filter(item => item.type === 'material').length;
  const subProductItemsCount = p.items.length - materialItemsCount;
  const hasSubProducts = subProductItemsCount > 0;
  const isPaused = !p.isCustomRecipe && !!p.isPaused;

  return (
    <div id={id} role={groupLabel ? 'group' : undefined} aria-label={groupLabel} className={`flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 shadow-xs transition-shadow hover:shadow-md ${isPaused ? 'bg-stone-50/70 opacity-75' : 'bg-white'}`}>
      <div>
        <div className={`flex items-start gap-4 ${compactHeader ? 'p-4 pb-3 sm:px-5' : 'p-5 pb-4'}`}>
          {/* Photo or Icon */}
          {(!compactHeader || p.imageUrl) && <div className={`rounded-xl bg-stone-100 border border-stone-200 shrink-0 overflow-hidden flex items-center justify-center ${compactHeader ? 'size-12' : 'size-16 sm:size-20'}`}>
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-stone-400 flex flex-col items-center">
                <ImageIcon className="w-7 h-7 stroke-1" />
                <span className="text-[10px] mt-0.5 text-stone-400 font-medium">Sem foto</span>
              </div>
            )}
          </div>}

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {p.category && <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                {p.category}
              </span>}

              {p.productFamily && (
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  {p.productFamily}
                </span>
              )}

              {p.fragrance && (
                <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {p.fragrance}
                </span>
              )}

              {(badge || p.isCustomRecipe) && (
                <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {badge || 'Personalizada'}
                </span>
              )}

              {isPaused && (
                <span className="text-[11px] font-medium text-stone-600 bg-stone-200/90 border border-stone-300 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0" title="Item pausado manualmente">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                  Pausado
                </span>
              )}

              {p.isIntermediate ? (
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1" title="Disponível como sub-produto, mas não aparece em pedidos">
                  <Layers className="w-3 h-3 text-amber-700" />
                  Receita Interna
                </span>
              ) : p.isIntermediate === false ? (
                <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Produto Final
                </span>
              ) : null}

              {p.batchYield > 1 && (
                <span className="text-[11px] text-stone-500 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                  Rende {p.batchYield} un
                </span>
              )}
            </div>

            <Heading className="break-words text-base font-bold leading-snug text-stone-900">
              {p.name}
            </Heading>
            {p.isCustomRecipe && p.sourceCustomerName && (
              <p className="text-[11px] text-purple-700 mt-0.5">
                Criada para {p.sourceCustomerName}
              </p>
            )}

            {p.description && (
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                {p.description}
              </p>
            )}

            {p.notes && (
              <p className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200/80 rounded-md px-2 py-1 mt-1.5 line-clamp-2 italic" title={p.notes}>
                <span className="font-semibold not-italic text-stone-700">Obs: </span>
                {p.notes}
              </p>
            )}

            {/* Composition summary badge */}
            {!compactHeader && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-stone-400" />
                {materialItemsCount} {materialItemsCount === 1 ? 'material' : 'materiais'}
              </span>
              {hasSubProducts && (
                <span className="flex items-center gap-1 text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  {subProductItemsCount} {subProductItemsCount === 1 ? 'sub-produto' : 'sub-produtos'}
                </span>
              )}
              {p.productionTimeMinutes != null && <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                {p.productionTimeMinutes} min
              </span>}
            </div>}
          </div>
        </div>
        {financials && (
          <div className="border-y border-stone-100 bg-stone-50 px-5 py-3.5">
            <RecipeCostSummary {...financials} compact />
          </div>
        )}
        {children}
      </div>
      {footer}
    </div>
  );
}
