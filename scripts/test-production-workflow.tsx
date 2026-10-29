import { workspaceStorage } from "../src/utils/workspaceStorage";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { productionWorkspace } from "./productionFixtures";

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: "http://localhost/",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Event",
  "MouseEvent",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
const alerts: string[] = [];
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  alert: (m: string) => alerts.push(m),
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
  cancelAnimationFrame: clearTimeout,
});
dom.window.confirm = () => true;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
workspaceStorage.setItem(
  "atelie_workspace_finance_v1",
  JSON.stringify(productionWorkspace()),
);
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("../src/App");
let root = createRoot(document.querySelector("#root")!);
const saved = () =>
  JSON.parse(workspaceStorage.getItem("atelie_workspace_finance_v1")!);
const click = async (selector: string) => {
  const el = document.querySelector<HTMLElement>(selector);
  assert(el, selector);
  await act(async () => el.click());
};
const button = async (text: string) => {
  const el = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert(el, text);
  await act(async () => el.click());
};
const fill = async (
  el: HTMLInputElement | HTMLSelectElement,
  value: string,
) => {
  assert(el);
  await act(async () => {
    const proto =
      el.tagName === "SELECT"
        ? dom.window.HTMLSelectElement.prototype
        : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(
      new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
};
const choose = async (
  index: number,
  model: string,
  product?: string,
  quantity = "1",
) => {
  const row = () => document.querySelectorAll("[data-production-row]")[index];
  const search = row().querySelector<HTMLInputElement>('input[id$="-model"]')!;
  await act(async () => { search.focus(); search.click(); });
  const option = [...row().querySelectorAll<HTMLButtonElement>('[role="option"]')].find(option => option.dataset.modelId === model);
  assert(option, `Modelo ${model}`);
  await act(async () => option.click());
  if (product)
    await fill(row().querySelector('select[id$="-aroma"]')!, product);
  await fill(row().querySelector('input[type="number"]')!, quantity);
};
const stock = (id: string) =>
  saved().materials.find((m: any) => m.id === id).currentStock;
await act(async () => root.render(<App />));
await click('[aria-label="Abrir atalhos rápidos"]');
await button("Produções");
assert(
  document
    .querySelector('[role="tab"][aria-selected="true"]')
    ?.textContent?.includes("Em andamento"),
);
await click("#btn-add-production");
assert(document.querySelector(".liare-new-production"));
assert.equal(
  document.querySelector("dialog"),
  null,
  "Nova produção is a page, not a popup",
);
const model = document.querySelector(
  'input[id$="-model"]',
) as HTMLInputElement;
await act(async () => model.focus());
assert.equal(
  document.querySelectorAll('[role="option"]').length,
  2,
  "Uma opção por modelo, sem repetir os aromas da família",
);
await fill(model, 'modelo que não existe');
assert(document.body.textContent?.includes('Nenhum modelo encontrado'));
await fill(model, 'LATINHA');
assert.equal(document.querySelectorAll('[role="option"]').length, 1);
await act(async () => model.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
assert.equal((document.querySelector('select[id$="-aroma"]') as HTMLSelectElement).value, '', 'Buscar um modelo não escolhe seu aroma automaticamente.');
const counter = document.querySelector<HTMLInputElement>('[aria-label="Unidades do item 1"]')!;
const minus = '[aria-label="Diminuir unidades do item 1"]';
const plus = '[aria-label="Aumentar unidades do item 1"]';
assert((document.querySelector(minus) as HTMLButtonElement).disabled);
await click(plus);
assert.equal(counter.value, '2');
await fill(counter, '27');
await click(minus);
assert.equal(counter.value, '26', 'O contador continua a partir da quantidade digitada.');
assert.equal(saved().productions.length, 0, 'Buscar e ajustar unidades não inicia a produção.');
await choose(0, "mother:mother", "mother", "4");
await click("#btn-add-production-item");
await choose(1, "mother:mother", "child", "3");
await click('[aria-label="Aumentar unidades do item 2"]');
assert.equal((document.querySelector('[aria-label="Unidades do item 1"]') as HTMLInputElement).value, '4');
await click('[aria-label="Diminuir unidades do item 2"]');
await fill(
  document.querySelector('[aria-label="Observação da produção"]')!,
  "Produção conjunta",
);
await click("#btn-start-productions");
assert.equal(saved().productions.length, 2);
assert(
  saved().productions.every(
    (p: any) =>
      p.status === "in_progress" &&
      !p.deductedItems.length &&
      p.notes === "Produção conjunta",
  ),
);
assert.equal(stock("wax"), 1000, "Starting stages does not consume stock");
assert.equal(saved().stockMovements.length, 0);
const motherProduction = saved().productions.find(
  (p: any) => p.productId === "mother",
).id;
const childProduction = saved().productions.find(
  (p: any) => p.productId === "child",
).id;
const beforePlanning = JSON.stringify(saved());
const card = document.querySelector(`#production-item-${motherProduction}`)!;
await act(async () => { card.querySelector('details')!.open = true; });
const fullRecord = [...card.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Ver registro completo')!;
await act(async () => fullRecord.click());
assert(document.querySelector('[aria-label="Planejamento dos insumos"]'), 'O panorama está no registro completo da produção em andamento.');
await fill(document.querySelector('[aria-label="Planejamento dos insumos"] input[type="number"]')!, '3');
assert(document.querySelector('[aria-label="Planejamento: Fabricação"]')?.textContent?.includes('30 g'));
assert.equal(JSON.stringify(saved()), beforePlanning, 'Consultar o registro e simular unidades não salva alterações na base.');
await button('Voltar para produção');
const openMother = () =>
  click(`[data-advance-production="${motherProduction}"]`);
await openMother();
assert.equal(document.querySelector("dialog"), null);
const stagePage = document.querySelector('.liare-production-detail');
await fill(
  document.querySelector('.liare-production-detail input[type="number"]')!,
  "2",
);
await button("Registrar etapa");
assert.equal(document.querySelector('.liare-production-detail'), stagePage, 'Registrar uma etapa parcial mantém a página aberta.');
assert(document.body.textContent?.includes('Fabricação registrada: 2 un.'));
assert.equal((document.querySelector('#production-stage-quantity') as HTMLInputElement).value, '2');
assert.equal(stock("wax"), 980);
assert.equal(stock("vanilla"), 98);
assert.equal(
  saved().products.find((p: any) => p.id === "mother").currentStock,
  0,
);
assert.equal(
  saved().productions.find((p: any) => p.id === childProduction)
    .stageProgress[0].completedQuantity,
  0,
);
const labelStage = [
  ...document.querySelectorAll<HTMLButtonElement>(
    ".liare-production-detail button",
  ),
].find((b) => b.textContent?.includes("Rotulagem"))!;
await act(async () => labelStage.click());
assert(document.body.textContent?.includes('Liberadas para registrar agora: 2 un'));
await fill(
  document.querySelector('.liare-production-detail input[type="number"]')!,
  "1",
);
await button("Concluir etapa e adicionar ao estoque");
assert.equal(document.querySelector('.liare-production-detail'), stagePage, 'Também permanece aberta após registrar unidades da etapa final.');
assert.equal(
  saved().products.find((p: any) => p.id === "mother").currentStock,
  1,
);
assert.equal(stock("label"), 99);
const fabricationStage = [...document.querySelectorAll<HTMLButtonElement>('.liare-production-detail button')].find(b => b.textContent?.includes('Fabricação'))!;
await act(async () => fabricationStage.click());
await button("Registrar etapa");
assert.equal(stock("wax"), 960);
assert.equal(document.querySelector('.liare-production-detail'), stagePage);
assert(document.querySelector('.liare-production-detail button[aria-pressed="true"]')?.textContent?.includes('Rotulagem'), 'Concluir a etapa seleciona a próxima na mesma página.');
assert(document.body.textContent?.includes('Liberadas para registrar agora: 3 un'));
await fill(
  document.querySelector('.liare-production-detail input[type="number"]')!,
  "4",
);
const excessive = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Concluir etapa e adicionar ao estoque')!;
assert(excessive.disabled, 'A quantidade pode ser simulada, mas uma baixa acima do disponível fica bloqueada.');
await act(async () => excessive.click());
assert.equal(alerts.length, 0);
assert.equal(
  saved().products.find((p: any) => p.id === "mother").currentStock,
  1,
);
await fill(
  document.querySelector('.liare-production-detail input[type="number"]')!,
  "3",
);
await button("Concluir etapa e adicionar ao estoque");
assert.equal(
  saved().productions.find((p: any) => p.id === motherProduction).status,
  "completed",
);
assert.equal(
  saved().products.find((p: any) => p.id === "mother").currentStock,
  4,
);
assert.equal(stock("label"), 96);
assert.equal(document.querySelector('.liare-production-detail'), stagePage, 'Concluir toda a produção também mantém a página aberta.');
assert(document.body.textContent?.includes('Produção concluída.'));
const completedButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === 'Concluir etapa e adicionar ao estoque')!;
assert(completedButton.disabled, 'A conclusão não permite registrar novamente as mesmas unidades.');
const completedSnapshot = JSON.stringify(saved());
await act(async () => completedButton.click());
assert.equal(JSON.stringify(saved()), completedSnapshot);
await button('Voltar para produção');
assert.equal(document.querySelector('.liare-production-detail'), null, 'A página só sai ao voltar explicitamente.');

// A direct batch records all lines once, merging duplicate product/ingredient selections.
await click("#btn-add-production");
await choose(0, "product:direct", undefined, "2");
await click("#btn-add-production-item");
await choose(1, "product:direct", undefined, "3");
await click("#btn-start-productions");
assert.equal(saved().productions.length, 3);
assert.equal(
  saved().productions.find((p: any) => p.productId === "direct")
    .quantityProduced,
  5,
);
assert.equal(
  saved().products.find((p: any) => p.id === "direct").currentStock,
  5,
);
assert.equal(stock("wax"), 910);
assert.equal(stock("vanilla"), 91);
assert.equal(stock("label"), 91);
const beforeReload = saved();
await act(async () => root.unmount());
root = createRoot(document.querySelector("#root")!);
await act(async () => root.render(<App />));
assert.deepEqual(saved().productions, beforeReload.productions);
assert.deepEqual(saved().stockMovements, beforeReload.stockMovements);
assert.equal(stock("wax"), 910);
// Separate starts of the same recipe share one live block and one phase form.
await click('[aria-label="Abrir atalhos rápidos"]');
await button('Produções');
const startMother = async (quantity: string, notes: string) => {
  await click('#btn-add-production');
  await choose(0, 'mother:mother', 'mother', quantity);
  await fill(document.querySelector('[aria-label="Observação da produção"]')!, notes);
  await click('#btn-start-productions');
};
const motherGroup = () => document.querySelector<HTMLElement>('[data-production-group="mother"]')!;
const queue = (key: string) => motherGroup().querySelector(`[data-production-stage="${key}"] [data-stage-quantity]`)!.textContent;
await startMother('3', 'Primeiro registro');
await startMother('2', 'Segundo registro');
assert.equal(document.querySelectorAll('[data-production-group="mother"]').length, 1);
assert.equal(motherGroup().querySelector('[data-production-remaining]')!.textContent, '5 un em produção');
assert.equal(queue('base:step'), '5 un');
assert.equal(queue('label:final'), '0 un');
// Searching one record still shows the whole product's quantity.
await fill(document.querySelector('[aria-label="Buscar produção"]')!, 'Primeiro registro');
assert.equal(motherGroup().querySelector('[data-production-remaining]')!.textContent, '5 un em produção');
await fill(document.querySelector('[aria-label="Buscar produção"]')!, '');
await click('[data-production-group="mother"] [data-production-stage="base:step"]');
await fill(document.querySelector('#production-stage-quantity')!, '4');
const groupedPage = document.querySelector('.liare-production-detail');
await button('Registrar etapa');
assert.equal(document.querySelector('.liare-production-detail'), groupedPage);
assert.equal(stock('wax'), 870, 'Combined registration consumes four pieces once across both saved batches.');
assert.equal(saved().productions.filter((p: any) => p.productId === 'mother' && p.status === 'in_progress').reduce((sum: number, p: any) => sum + p.stageProgress[0].completedQuantity, 0), 4);
const groupLabelButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.querySelector('p')?.textContent === 'Rotulagem')!;
await act(async () => groupLabelButton.click());
await fill(document.querySelector('#production-stage-quantity')!, '2');
const groupedFinish = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === 'Concluir etapa e adicionar ao estoque')!;
await act(async () => { groupedFinish.click(); groupedFinish.click(); });
assert.equal(saved().products.find((p: any) => p.id === 'mother').currentStock, 6, 'Double clicks never duplicate finished stock.');
await button('Voltar para produção');
assert.equal(motherGroup().querySelector('[data-production-remaining]')!.textContent, '3 un em produção');
assert.equal(queue('base:step'), '1 un');
assert.equal(queue('label:final'), '2 un');
await startMother('4', 'Novo início depois de concluir parte');
assert.equal(document.querySelectorAll('[data-production-group="mother"]').length, 1);
assert.equal(motherGroup().querySelector('[data-production-remaining]')!.textContent, '7 un em produção');
assert.equal(queue('base:step'), '5 un');
assert.equal(queue('label:final'), '2 un');
const groupedBeforeReload = saved();
await act(async () => root.unmount());
root = createRoot(document.querySelector('#root')!);
await act(async () => root.render(<App />));
assert.deepEqual(saved().productions, groupedBeforeReload.productions);
await click('[aria-label="Abrir atalhos rápidos"]');
await button('Produções');
assert.equal(motherGroup().querySelector('[data-production-remaining]')!.textContent, '7 un em produção');
await click('[data-production-group="mother"] [data-production-stage="label:final"]');
await button('Concluir etapa e adicionar ao estoque');
await button('Voltar para produção');
assert.equal(queue('label:final'), '0 un');
assert.equal(motherGroup().querySelector('[data-production-remaining]')!.textContent, '5 un em produção');
await click('[data-production-group="mother"] [data-production-stage="base:step"]');
await button('Registrar etapa');
await button('Concluir etapa e adicionar ao estoque');
assert(document.body.textContent?.includes('0 un em produção'));
assert(document.body.textContent?.includes('Produção concluída.'));
await button('Voltar para produção');
assert.equal(motherGroup(), null, 'No finished pieces remain in the active list.');
assert(document.querySelector('[data-production-group="child"]'), 'Another aroma keeps its own block.');
assert.equal(saved().products.find((p: any) => p.id === 'mother').currentStock, 13);
assert.equal(stock('wax'), 820);
assert.equal(stock('label'), 82);
assert.equal(saved().productions.filter((p: any) => p.productId === 'mother').length, 4, 'The original history is preserved.');
await click('#production-tab-completed');
assert.equal(document.querySelectorAll('#production-list article').length, 5);
assert.deepEqual(alerts, []);
await act(async () => root.unmount());
console.log(
  "App de produção: criação conjunta, modelos/aromas, etapas parciais sem popup, bloqueio de excesso, baixas reais, entrada final, repetição de linhas, blocos por produto, filas por etapa, baixa em vários lotes, conclusão parcial, novo início e reabertura passaram.",
);
process.exit(0);
