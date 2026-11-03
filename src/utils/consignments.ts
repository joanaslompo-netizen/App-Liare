import type { ConsignmentLocation, ConsignmentCountRow, FinanceData, Product, Sale, SaleItem, StockMovement } from '../types';
import type { LedgerWorkspace } from './financeLedger';
import { getProductFinancialSplit } from './financials';
import { canonicalJSON } from '../services/workspaceRecordStore';

export type ConsignmentStockCommand =
  | { type: 'consignment_location'; location: ConsignmentLocation; expected: string | null }
  | { type: 'consignment_send'; id: string; locationId: string; date: string; opening: boolean; items: { productId: string; quantity: number; unitPriceCents: number }[] }
  | { type: 'consignment_check'; id: string; locationId: string; date: string; periodStart: string; expectedStock: string; expectedCommission: number; rows: ConsignmentCountRow[]; note: string }
  | { type: 'consignment_undo'; id: string; locationId: string; date: string; originalId: string; expectedStock: string };
export type ConsignmentLot = { id: string; productId: string; name: string; quantity: number; unitPriceCents: number; businessCost: number; laborCost: number };
const fail = (message: string): never => { throw new Error(message); };
const cents = (value: number) => Math.round(value * 100);
const whole = (value: number) => Number.isSafeInteger(value) && value >= 0;
export const consignmentFingerprint = (value: unknown) => canonicalJSON(value ?? null);
export const consignmentStockFingerprint = (moves: StockMovement[], locationId: string) => canonicalJSON(moves.filter(move => move.consignment?.locationId === locationId));
export const consignmentChecks = (moves: StockMovement[], locationId: string) => {
  const undone = new Set(moves.filter(move => move.consignment?.locationId === locationId && move.consignment.kind === 'undo').map(move => move.consignment!.originalOperationId));
  return moves.filter(move => move.consignment?.locationId === locationId && move.consignment.kind === 'check' && !undone.has(move.consignment.operationId));
};
export function consignmentLots(moves: StockMovement[], locationId: string): ConsignmentLot[] {
  const lots = new Map<string, ConsignmentLot>();
  for (const move of moves) {
    const detail = move.consignment;
    if (move.locationId !== locationId || !detail?.lotId) continue;
    const lot = lots.get(detail.lotId);
    if (lot) lot.quantity += move.quantity;
    else if (detail.kind === 'send' || detail.kind === 'opening') lots.set(detail.lotId, { id: detail.lotId, productId: move.targetId,
      name: detail.productName || 'Produto anterior', quantity: move.quantity, unitPriceCents: detail.unitPriceCents!, businessCost: move.businessUnitCost || 0, laborCost: detail.laborUnitCost || 0 });
    else fail('Um movimento de consignação perdeu o vínculo com o envio original.');
  }
  if ([...lots.values()].some(lot => lot.quantity < 0)) fail('Há movimentos conflitantes no estoque consignado. Reabra o local para conferir.');
  return [...lots.values()];
}
export function consignmentStock(moves: StockMovement[], locationId: string) {
  const rows = new Map<string, { productId: string; name: string; quantity: number; valueCents: number }>();
  for (const lot of consignmentLots(moves, locationId)) {
    const row = rows.get(lot.productId) || { productId: lot.productId, name: lot.name, quantity: 0, valueCents: 0 };
    row.quantity += lot.quantity; row.valueCents += lot.quantity * lot.unitPriceCents; rows.set(lot.productId, row);
  }
  return [...rows.values()].filter(row => row.quantity > 0);
}
export function availableAtelier(product: Product, sales: Sale[]) {
  const reserved = sales.filter(sale => sale.commercialStatus !== 'cancelled' && sale.commercialStatus !== 'draft').reduce((sum, sale) => sum + (sale.items || []).reduce((n, item) => n + ((item.isCustom ? item.customProductId : item.productId) === product.id ? item.reservedQuantity || 0 : 0), 0), 0);
  return Math.max(0, (product.currentStock || 0) - reserved);
}
export function previewConsignmentCheck(moves: StockMovement[], locationId: string, rows: ConsignmentCountRow[], commissionPercent: number) {
  const lots = consignmentLots(moves, locationId).map(lot => ({ ...lot }));
  const current = consignmentStock(moves, locationId);
  if (new Set(rows.map(row => row.productId)).size !== rows.length || rows.length !== current.length || current.some(row => !rows.some(value => value.productId === row.productId))) fail('Confira todos os produtos do local antes de salvar.');
  const consumed: { kind: 'sale' | 'return' | 'loss'; lot: ConsignmentLot; quantity: number }[] = [];
  for (const row of rows) {
    if (![row.remaining, row.returned, row.lost].every(whole)) fail('Use quantidades inteiras, a partir de zero.');
    const stock = current.find(item => item.productId === row.productId)!.quantity;
    const sold = stock - row.remaining - row.returned - row.lost;
    if (sold < 0) fail('A soma do que restou, voltou e foi perdido supera o estoque. Registre as reposições antes da conferência.');
    for (const [kind, quantity] of [['sale', sold], ['return', row.returned], ['loss', row.lost]] as const) {
      let pending = quantity;
      for (const lot of lots.filter(lot => lot.productId === row.productId && lot.quantity > 0)) {
        const used = Math.min(lot.quantity, pending); if (!used) continue;
        consumed.push({ kind, lot: { ...lot }, quantity: used }); lot.quantity -= used; pending -= used;
      }
      if (pending) fail('O estoque do local foi alterado. Reabra a conferência.');
    }
  }
  const grossCents = consumed.filter(row => row.kind === 'sale').reduce((sum, row) => sum + row.quantity * row.lot.unitPriceCents, 0);
  const commissionCents = Math.round(grossCents * commissionPercent / 100);
  return { consumed, grossCents, commissionCents, netCents: grossCents - commissionCents };
}
function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) fail('Informe uma data válida.');
}
export function applyConsignmentStockCommand<T extends LedgerWorkspace>(source: T, command: ConsignmentStockCommand): T {
  const finance: FinanceData = source.finance || { version: 1, entries: [], bills: [] };
  const locations = finance.consignmentLocations || [];
  if (command.type === 'consignment_location') {
    const input = command.location, previous = locations.find(location => location.id === input.id);
    const location = { ...input, name: input.name.trim(), contact: input.contact.trim(), notes: input.notes.trim() };
    if (!location.id || !location.name || !Number.isFinite(location.commissionPercent) || location.commissionPercent < 0 || location.commissionPercent > 100) fail('Informe o nome do local e uma comissão entre 0% e 100%.');
    if (consignmentFingerprint(previous) === consignmentFingerprint(location)) return source;
    if (consignmentFingerprint(previous) !== (command.expected ?? consignmentFingerprint(null))) fail('Este local foi alterado em outro aparelho. Reabra o cadastro antes de salvar.');
    const reversed = new Set(finance.entries.filter(entry => entry.kind === 'reversal').map(entry => entry.referenceId));
    const outstanding = source.sales.filter(sale => sale.consignmentLocationId === location.id && sale.commercialStatus !== 'cancelled').reduce((sum, sale) => sum + Math.max(0, cents(sale.totalRevenue) - (sale.consignmentCommissionCents || 0) - finance.entries.filter(entry => entry.saleId === sale.id && entry.kind === 'receipt' && !reversed.has(entry.id)).reduce((n,entry) => n + (entry.allocatedCents || 0),0)),0);
    if (location.archived && (consignmentStock(source.stockMovements || [],location.id).length || outstanding > 0)) fail('Retire as peças e acerte os repasses pendentes antes de inativar este local.');
    return { ...source, finance: { ...finance, consignmentLocations: previous ? locations.map(value => value.id === location.id ? location : value) : [...locations, location] } };
  }
  const fingerprint = canonicalJSON(command.type === 'consignment_check' || command.type === 'consignment_undo' ? { ...command, expectedStock: '' } : command);
  const old = (source.stockMovements || []).find(move => move.consignment?.operationId === command.id);
  if (old) { if (old.consignment!.fingerprint !== fingerprint) fail('Esta operação já foi registrada com outros dados.'); return source; }
  if (!command.id) fail('Operação de consignação inválida.');
  const location = locations.find(location => location.id === command.locationId) || fail('Local de consignação não encontrado.');
  if (location.archived) fail('Reative o local antes de movimentar o estoque.');
  validDate(command.date);
  const moves = [...(source.stockMovements || [])];
  if (moves.some(move => move.consignment?.locationId === location.id && move.date > command.date)) fail('Use uma data igual ou posterior à última movimentação deste local.');
  if ((command.type === 'consignment_check' || command.type === 'consignment_undo') && consignmentStockFingerprint(moves, location.id) !== command.expectedStock) fail('O estoque deste local mudou. Reabra a conferência antes de registrar.');
  let products = [...source.products], sales = [...source.sales];
  const add = (move: Omit<StockMovement, 'consignment'>, detail: Omit<NonNullable<StockMovement['consignment']>, 'locationId' | 'operationId' | 'fingerprint'>) => moves.push({ ...move, consignment: { ...detail, locationId: location.id, operationId: command.id, fingerprint } });
  const restore = (productId: string, quantity: number, business: number, labor: number) => {
    const product = products.find(value => value.id === productId) || fail('Um produto devolvido não está mais no catálogo. Restaure seu cadastro antes de devolver.');
    const stock = product.currentStock || 0, split = getProductFinancialSplit(product);
    products = products.map(value => value.id === productId ? { ...value, currentStock: stock + quantity,
      inventoryBusinessCost: (stock * (product.inventoryBusinessCost ?? split.businessCostPerUnit) + quantity * business) / (stock + quantity),
      inventoryLaborCost: (stock * (product.inventoryLaborCost ?? split.laborRemunerationPerUnit) + quantity * labor) / (stock + quantity) } : value);
  };
  if (command.type === 'consignment_send') {
    if (!command.items.length || new Set(command.items.map(item => item.productId)).size !== command.items.length) fail('Inclua os produtos do envio uma única vez.');
    command.items.forEach((item, index) => {
      if (!whole(item.quantity) || !item.quantity || !whole(item.unitPriceCents) || !item.unitPriceCents) fail('Informe quantidade inteira e preço maior que zero.');
      const product = products.find(product => product.id === item.productId) || fail('Produto não encontrado.');
      if (product.isIntermediate || product.isCustomRecipe || product.isPaused) fail('Selecione uma vela ativa do catálogo.');
      if (!command.opening && availableAtelier(product, sales) < item.quantity) fail(`Estoque disponível insuficiente para ${product.name}. As peças reservadas para pedidos foram preservadas.`);
      const split = getProductFinancialSplit(product), business = product.inventoryBusinessCost ?? split.businessCostPerUnit, labor = product.inventoryLaborCost ?? split.laborRemunerationPerUnit;
      const id = `${command.id}:lot:${index}`, detail = { kind: command.opening ? 'opening' as const : 'send' as const, lotId: id, productName: product.name, unitPriceCents: item.unitPriceCents, laborUnitCost: labor };
      add({ id, date: command.date, targetId: product.id, type: 'product', quantity: item.quantity, locationId: location.id, businessUnitCost: business, reason: command.opening ? 'Saldo inicial em consignação' : 'Envio para consignação' }, detail);
      if (!command.opening) {
        products = products.map(value => value.id === product.id ? { ...value, currentStock: (value.currentStock || 0) - item.quantity } : value);
        add({ id: `${id}:atelier`, date: command.date, targetId: product.id, type: 'product', quantity: -item.quantity, businessUnitCost: business, reason: `Enviado para ${location.name}` }, detail);
      }
    });
  }
  if (command.type === 'consignment_check') {
    validDate(command.periodStart);
    if (command.periodStart > command.date) fail('O início do período não pode ser posterior ao fechamento.');
    if (command.expectedCommission !== location.commissionPercent) fail('A comissão do local mudou. Confira os valores antes de registrar.');
    const plan = previewConsignmentCheck(moves, location.id, command.rows, location.commissionPercent);
    const saleId = `consignment:${command.id}`;
    plan.consumed.forEach((row, index) => {
      const detail = { kind: row.kind, lotId: row.lot.id, productName: row.lot.name, unitPriceCents: row.lot.unitPriceCents, laborUnitCost: row.lot.laborCost };
      add({ id: `${command.id}:${index}`, date: command.date, targetId: row.lot.productId, type: 'product', quantity: -row.quantity, locationId: location.id, businessUnitCost: row.lot.businessCost, reason: row.kind === 'sale' ? 'Venda consignada' : row.kind === 'return' ? 'Devolução ao ateliê' : 'Perda / avaria em consignação', referenceId: saleId }, detail);
      if (row.kind === 'return') {
        restore(row.lot.productId, row.quantity, row.lot.businessCost, row.lot.laborCost);
        add({ id: `${command.id}:${index}:atelier`, date: command.date, targetId: row.lot.productId, type: 'product', quantity: row.quantity, businessUnitCost: row.lot.businessCost, reason: `Retorno de ${location.name}`, referenceId: saleId }, detail);
      }
    });
    add({ id: `${command.id}:check`, date: command.date, targetId: location.id, type: 'product', quantity: 0, locationId: location.id, reason: 'Conferência de consignação', referenceId: saleId, note: command.note }, { kind: 'check', periodStart: command.periodStart, commissionPercent: location.commissionPercent, checkRows: command.rows.map(row => ({ ...row })) });
    const items: SaleItem[] = plan.consumed.filter(row => row.kind === 'sale').map((row, index) => ({ id: `${saleId}:${index}`, productId: row.lot.productId, productName: row.lot.name,
      quantity: row.quantity, deliveredQuantity: row.quantity, reservedQuantity: 0, unitPrice: row.lot.unitPriceCents / 100, unitCost: row.lot.businessCost + row.lot.laborCost,
      unitBusinessCost: row.lot.businessCost, unitLaborRemuneration: row.lot.laborCost, totalCost: row.quantity * (row.lot.businessCost + row.lot.laborCost) }));
    if (items.length) {
      const business = items.reduce((n, item) => n + item.quantity * item.unitBusinessCost!, 0), labor = items.reduce((n, item) => n + item.quantity * item.unitLaborRemuneration!, 0);
      sales = [{ id: saleId, date: command.date, createdAt: new Date().toISOString(), customerName: location.name,
        productId: items[0].productId, productName: `Consignação · ${location.name}`, quantity: items.reduce((n, item) => n + item.quantity, 0), unitPrice: items[0].unitPrice, unitCost: items[0].unitCost,
        totalRevenue: plan.grossCents / 100, totalCost: business + labor, totalBusinessCost: business, totalLaborRemuneration: labor,
        totalProfit: plan.netCents / 100 - business, marginPercent: plan.grossCents ? (plan.netCents - cents(business)) / plan.grossCents * 100 : 0,
        financialTracking: true, legacyPaidCents: 0, deliveryStatus: 'entregue', deliveryActualDate: command.date, commercialStatus: 'confirmed', items,
        consignmentLocationId: location.id, consignmentCommissionPercent: location.commissionPercent, consignmentCommissionCents: plan.commissionCents, consignmentPeriodStart: command.periodStart, notes: command.note }, ...sales];
    }
  }
  if (command.type === 'consignment_undo') {
    const localMoves = moves.filter(move => move.consignment?.locationId === location.id);
    if (localMoves.at(-1)?.consignment?.operationId !== command.originalId) fail('Só é possível desfazer a última conferência, antes de uma nova movimentação no local.');
    const original = localMoves.filter(move => move.consignment?.operationId === command.originalId);
    if (!original.some(move => move.consignment?.kind === 'check')) fail('Conferência não encontrada.');
    const sale = sales.find(sale => sale.id === `consignment:${command.originalId}`);
    const reversed = new Set(finance.entries.filter(entry => entry.kind === 'reversal').map(entry => entry.referenceId));
    if (sale && finance.entries.some(entry => entry.saleId === sale.id && entry.kind !== 'reversal' && !reversed.has(entry.id))) fail('Estorne os recebimentos deste acerto no Financeiro antes de desfazer a conferência.');
    original.filter(move => move.quantity !== 0).forEach((move, index) => {
      if (!move.locationId && move.quantity > 0) {
        const product = products.find(product => product.id === move.targetId) || fail('Produto devolvido não encontrado.');
        if (availableAtelier(product, sales) < move.quantity) fail('As peças devolvidas já foram utilizadas ou reservadas. Não é possível desfazer esta conferência.');
        const stock = product.currentStock || 0, remaining = stock - move.quantity, split = getProductFinancialSplit(product);
        const business = stock * (product.inventoryBusinessCost ?? split.businessCostPerUnit) - move.quantity * (move.businessUnitCost || 0);
        const labor = stock * (product.inventoryLaborCost ?? split.laborRemunerationPerUnit) - move.quantity * (move.consignment?.laborUnitCost || 0);
        if (business < -0.01 || labor < -0.01) fail('O custo do estoque devolvido mudou. Confira as movimentações antes de desfazer a conferência.');
        products = products.map(value => value.id === product.id ? { ...value, currentStock: remaining,
          inventoryBusinessCost: remaining > 0 ? Math.max(0,business) / remaining : product.inventoryBusinessCost,
          inventoryLaborCost: remaining > 0 ? Math.max(0,labor) / remaining : product.inventoryLaborCost } : value);
      }
      add({ ...move, id: `${command.id}:${index}`, date: command.date, quantity: -move.quantity, reason: 'Correção de conferência consignada', referenceId: sale?.id }, { ...move.consignment!, kind: move.consignment!.kind === 'loss' ? 'loss' : 'undo', originalOperationId: command.originalId });
    });
    // Keep a marker even if the original conference contained no movements.
    add({ id: `${command.id}:undo`, date: command.date, targetId: location.id, type: 'product', quantity: 0, locationId: location.id, reason: 'Conferência desfeita' }, { kind: 'undo', originalOperationId: command.originalId });
    if (sale) sales = sales.map(value => value.id === sale.id ? { ...value, commercialStatus: 'cancelled', cancelledAt: command.date } : value);
  }
  consignmentLots(moves, location.id);
  return { ...source, products, sales, stockMovements: moves };
}
