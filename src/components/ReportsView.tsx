import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  Package, 
  Printer, 
  Clock, 
  Award, 
  ArrowUpRight, 
  Layers, 
  ShoppingCart,
  ChevronDown
} from 'lucide-react';
import { Sale, Purchase, Product, Material } from '../types';
import { 
  formatCurrency, 
  formatPercent, 
  formatMonthYear, 
  formatNumber 
} from '../utils/formatters';

interface ReportsViewProps {
  sales: Sale[];
  purchases: Purchase[];
  products: Product[];
  materials: Material[];
  onOpenPurchaseHistory?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  sales,
  purchases,
  products,
  materials,
  onOpenPurchaseHistory,
}) => {
  // Available months extracted from sales & purchases
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Add current month by default
    const currentMonth = new Date().toISOString().slice(0, 7);
    monthsSet.add(currentMonth);

    sales.forEach((s) => monthsSet.add(s.date.slice(0, 7)));
    purchases.forEach((p) => monthsSet.add(p.date.slice(0, 7)));

    return Array.from(monthsSet).sort().reverse();
  }, [sales, purchases]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || '2026-09');

  // Filtered by selected month
  const monthSales = useMemo(() => {
    if (selectedMonth === 'all') return sales;
    return sales.filter((s) => s.date.startsWith(selectedMonth));
  }, [sales, selectedMonth]);

  const monthPurchases = useMemo(() => {
    if (selectedMonth === 'all') return purchases;
    return purchases.filter((p) => p.date.startsWith(selectedMonth));
  }, [purchases, selectedMonth]);

  // Aggregate metrics
  const totalRevenue = monthSales.reduce((acc, s) => acc + s.totalRevenue, 0);
  const totalCostOfGoodsSold = monthSales.reduce((acc, s) => acc + s.totalCost, 0);
  const netProfit = monthSales.reduce((acc, s) => acc + s.totalProfit, 0);
  const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const totalMaterialPurchases = monthPurchases.reduce((acc, p) => acc + p.totalAmount, 0);

  // Total labor time and pro-labore generated
  const totalLaborEstimated = useMemo(() => {
    return monthSales.reduce((acc, sale) => {
      const prod = products.find((p) => p.id === sale.productId);
      const laborPerUnit = prod ? prod.laborCost : 0;
      const minutesPerUnit = prod ? prod.productionTimeMinutes : 0;
      return {
        minutes: acc.minutes + (minutesPerUnit * sale.quantity),
        amount: acc.amount + (laborPerUnit * sale.quantity),
      };
    }, { minutes: 0, amount: 0 });
  }, [monthSales, products]);

  // Top profitable products in selected month
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    monthSales.forEach((s) => {
      const existing = map.get(s.productId) || { name: s.productName, qty: 0, revenue: 0, profit: 0 };
      map.set(s.productId, {
        name: s.productName,
        qty: existing.qty + s.quantity,
        revenue: existing.revenue + s.totalRevenue,
        profit: existing.profit + s.totalProfit,
      });
    });
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
  }, [monthSales]);

  // Material spending breakdown by category (from purchases in the month)
  const categorySpending = useMemo(() => {
    const map = new Map<string, number>();
    monthPurchases.forEach((p) => {
      p.items.forEach((it) => {
        const mat = materials.find((m) => m.id === it.materialId);
        const cat = mat ? mat.category : 'Outros';
        map.set(cat, (map.get(cat) || 0) + it.totalPrice);
      });
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthPurchases, materials]);

  // Channel breakdown
  const channelBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    monthSales.forEach((s) => {
      const ch = s.channel || 'Balcão / Geral';
      const existing = map.get(ch) || { count: 0, revenue: 0 };
      map.set(ch, {
        count: existing.count + s.quantity,
        revenue: existing.revenue + s.totalRevenue,
      });
    });
    return Array.from(map.entries()).map(([channel, data]) => ({
      channel,
      count: data.count,
      revenue: data.revenue,
    }));
  }, [monthSales]);

  // Historical months comparison for trend chart
  const historicalTrend = useMemo(() => {
    return availableMonths.slice(0, 6).reverse().map((mKey) => {
      const mSales = sales.filter((s) => s.date.startsWith(mKey));
      const mPurchases = purchases.filter((p) => p.date.startsWith(mKey));
      const rev = mSales.reduce((acc, s) => acc + s.totalRevenue, 0);
      const prof = mSales.reduce((acc, s) => acc + s.totalProfit, 0);
      const pur = mPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
      return {
        monthKey: mKey,
        label: formatMonthYear(mKey).split(' de ')[0], // Month name
        revenue: rev,
        profit: prof,
        purchases: pur,
      };
    });
  }, [availableMonths, sales, purchases]);

  const maxChartValue = Math.max(
    ...historicalTrend.map((h) => Math.max(h.revenue, h.purchases, 100)),
    500
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
            Relatórios Mensais de Desempenho
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Análise de faturamento, custo das peças, compras de estoque e lucro real do seu ateliê.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Dropdown */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <select
              id="select-report-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm font-semibold bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 shadow-2xs appearance-none cursor-pointer"
            >
              <option value="all">Visão Geral (Todo o Histórico)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthYear(m)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={onOpenPurchaseHistory}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 bg-white border border-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 text-amber-700" />
            Histórico de Compras
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 bg-white border border-stone-200 rounded-xl transition-colors cursor-pointer"
            title="Imprimir relatório"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold block">
            Faturamento do Mês
          </span>
          <span className="text-2xl sm:text-3xl font-black text-stone-900 mt-1 block">
            {formatCurrency(totalRevenue)}
          </span>
          <span className="text-xs text-stone-500 mt-1 block">
            {monthSales.length} {monthSales.length === 1 ? 'pedido faturado' : 'pedidos faturados'}
          </span>
        </div>

        {/* Cost of Goods Sold */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold block">
            Custo das Peças Vendidas
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-stone-700 mt-1 block">
            {formatCurrency(totalCostOfGoodsSold)}
          </span>
          <span className="text-xs text-stone-500 mt-1 block">
            materiais, insumos e custos fixos
          </span>
        </div>

        {/* Net Profit */}
        <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200/90 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-emerald-900 font-bold block flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" /> Lucro Líquido Real
          </span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 block">
            +{formatCurrency(netProfit)}
          </span>
          <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-emerald-800">
            <span>Margem Real: {formatPercent(marginPercent)}</span>
          </div>
        </div>

        {/* Material Purchases in month */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-amber-900 font-semibold block flex items-center gap-1">
            <ShoppingCart className="w-3.5 h-3.5 text-amber-700" /> Compras de Materiais
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 block">
            {formatCurrency(totalMaterialPurchases)}
          </span>
          <span className="text-xs text-stone-500 mt-1 block">
            investido em reposição de estoque
          </span>
        </div>
      </div>

      {/* Artisan Pro-labore Highlight */}
      <div className="bg-stone-900 text-stone-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-base text-white">
              Remuneração da Sua Mão de Obra (Pro-labore)
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Tempo de confecção faturado em peças vendidas neste mês: {(totalLaborEstimated.minutes / 60).toFixed(1)} horas de trabalho.
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span className="text-xs text-stone-400 uppercase tracking-wider block">
            Valor Ganho pelo seu Trabalho
          </span>
          <span className="text-2xl font-black text-amber-400">
            {formatCurrency(totalLaborEstimated.amount)}
          </span>
        </div>
      </div>

      {/* Charts & Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Historical Evolution Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  Evolução Mensal (Receitas vs Compras vs Lucro)
                </h3>
                <p className="text-xs text-stone-500">
                  Comparativo dos últimos meses do seu ateliê
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-stone-600">
                  <span className="w-3 h-3 rounded-xs bg-stone-900" /> Receita
                </span>
                <span className="inline-flex items-center gap-1 text-stone-600">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500" /> Lucro
                </span>
                <span className="inline-flex items-center gap-1 text-stone-600">
                  <span className="w-3 h-3 rounded-xs bg-amber-400" /> Compras
                </span>
              </div>
            </div>

            {/* Custom Bar Graph */}
            <div className="h-48 pt-6 flex items-end justify-between gap-3 border-b border-stone-200">
              {historicalTrend.map((h, i) => {
                const revHeight = Math.max(8, (h.revenue / maxChartValue) * 100);
                const profHeight = Math.max(8, (h.profit / maxChartValue) * 100);
                const purHeight = Math.max(8, (h.purchases / maxChartValue) * 100);

                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      {/* Revenue Bar */}
                      <div
                        style={{ height: `${revHeight}%` }}
                        className="w-1/3 bg-stone-900 rounded-t-sm transition-all hover:bg-stone-800 relative cursor-pointer"
                        title={`Receita ${h.label}: ${formatCurrency(h.revenue)}`}
                      />
                      {/* Profit Bar */}
                      <div
                        style={{ height: `${profHeight}%` }}
                        className="w-1/3 bg-emerald-500 rounded-t-sm transition-all hover:bg-emerald-600 relative cursor-pointer"
                        title={`Lucro ${h.label}: ${formatCurrency(h.profit)}`}
                      />
                      {/* Purchases Bar */}
                      <div
                        style={{ height: `${purHeight}%` }}
                        className="w-1/3 bg-amber-400 rounded-t-sm transition-all hover:bg-amber-500 relative cursor-pointer"
                        title={`Compras ${h.label}: ${formatCurrency(h.purchases)}`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-stone-600 mt-2 block truncate">
                      {h.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span>Valores calculados em tempo real a partir dos lançamentos.</span>
            <span className="font-semibold text-stone-800">
              Fórmula: Lucro = Vendas - Custo Produção
            </span>
          </div>
        </div>

        {/* Top Profitable Products (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-amber-600" />
              Peças Mais Lucrativas do Mês
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Produtos que mais trouxeram retorno financeiro líquido
            </p>

            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400">
                Nenhuma venda registrada no período selecionado.
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.slice(0, 4).map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-100"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h5 className="font-semibold text-xs text-stone-900 truncate">
                          {p.name}
                        </h5>
                        <span className="text-[11px] text-stone-500">
                          {p.qty} {p.qty === 1 ? 'peça vendida' : 'peças vendidas'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-emerald-600 block">
                        +{formatCurrency(p.profit)}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {formatCurrency(p.revenue)} receita
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-400 text-center">
            Foque sua produção nas peças com maior retorno líquido por hora.
          </div>
        </div>

      </div>

      {/* Secondary Analytics: Categories & Sales Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Spending on Materials */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2 mb-1">
            <PieChart className="w-4 h-4 text-amber-600" />
            Gastos com Materiais por Categoria
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            Destino das compras de insumos realizadas no período selecionado
          </p>

          {categorySpending.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">
              Nenhuma compra de material neste mês.
            </div>
          ) : (
            <div className="space-y-3">
              {categorySpending.map((c, i) => {
                const pct = totalMaterialPurchases > 0 ? (c.amount / totalMaterialPurchases) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-stone-800">{c.category}</span>
                      <span className="font-bold text-stone-900">
                        {formatCurrency(c.amount)} ({formatPercent(pct)})
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-600 h-full rounded-full"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sales Channels Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-amber-600" />
            Desempenho por Canal de Venda
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            Onde seus clientes mais compram (Instagram, WhatsApp, Elo7, etc.)
          </p>

          {channelBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">
              Nenhuma venda registrada no período selecionado.
            </div>
          ) : (
            <div className="space-y-3">
              {channelBreakdown.map((ch, i) => {
                const pct = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-stone-800">{ch.channel}</span>
                      <span className="font-bold text-stone-900">
                        {formatCurrency(ch.revenue)} ({formatPercent(pct)}) • {ch.count} un
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-stone-900 h-full rounded-full"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
