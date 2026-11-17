import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { workspaceStorage } from '../src/utils/workspaceStorage';
import { ingredient, virtualFragranceWorkspace } from './virtualFragranceFixtures';
import { formatCurrency } from '../src/utils/formatters';
import { recalculateProductPricing } from '../src/utils/storage';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','localStorage']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const alerts:string[]=[];
let confirmApproval = true;
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,alert:(message:string)=>alerts.push(message),confirm:()=>confirmApproval,requestAnimationFrame:(fn:()=>void)=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};dom.window.scrollTo=()=>{};
const fixture=virtualFragranceWorkspace();
fixture.materials.push({...fixture.materials[1],id:'nested',name:'Mistura variável',isVirtualRecipe:true,isMadeInAtelier:true,batchYield:100,recipeItems:[{...ingredient('part','category:Essências',100),selectionMode:'category',targetCategory:'Essências'}]}, {...fixture.materials[1],id:'wrong-unit',name:'Essência em ml',unit:'ml'});
fixture.products[0] = recalculateProductPricing({
  ...fixture.products[0], productionTimeMinutes: 15, hourlyRate: 40, fixedCostPercent: 5, otherCosts: 2,
}, fixture.materials, fixture.products);
workspaceStorage.setItem('atelie_workspace_finance_v1',JSON.stringify(fixture));
const {createRoot}=await import('react-dom/client');const {default:App}=await import('../src/App');
let root=createRoot(document.querySelector('#root')!);
const saved=()=>JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!);
async function click(text:string,scope:ParentNode=document){const element=[...scope.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.trim()===text);assert(element,text);await act(async()=>element.click());}
async function fill(element:HTMLInputElement|HTMLSelectElement,value:string){assert(element,'Campo encontrado');await act(async()=>{const proto=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
function fieldInput(label: string) {
  const container = [...document.querySelectorAll('label')].find(element =>
    [...element.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim() === label);
  assert(container, label);
  return container.querySelector('input,select') as HTMLInputElement | HTMLSelectElement;
}
const field = (label: string, value: string) => fill(fieldInput(label), value);
async function choose(selector:string,name:string){const input=document.querySelector<HTMLInputElement>(selector);assert(input,selector);await act(async()=>input.focus());const option=[...input.parentElement!.parentElement!.querySelectorAll('li')].find(element=>element.textContent?.includes(name));assert(option,name);await act(async()=>option.click());}
async function open(){await act(async()=>(document.querySelector('[aria-label="Abrir atalhos rápidos"]') as HTMLButtonElement).click());await click('Projetos');}
const directSection=()=>document.querySelector('section[aria-label="Materiais do projeto"]')!;
const sections = () => document.querySelector('nav[aria-label="Seções do projeto"]')!;
const tab = (name: string) => click(name, sections());
const projectCard = (name: string) => [...document.querySelectorAll('article')].find(article => article.getAttribute('aria-label') === name)!;
const openProject = async (name: string) => {
  const button = projectCard(name).querySelector('button')!;
  await act(async () => button.click());
};
async function addDirect(aroma:string,quantity:string){await choose('#project-direct-material','Cera aromatizada');await choose('#project-direct-aroma-0',aroma);await fill(directSection().querySelector('input[type=number]')!,quantity);await click('Adicionar',directSection());}
const summary=()=>document.querySelector('[aria-label="Resumo do orçamento"]')!;
const requirements=()=>document.querySelector('ul[aria-label="Insumos do orçamento"]')!;
const preview=(cost:number)=>assert(summary().textContent?.includes(formatCurrency(cost)),`Custo previsto ${cost}: ${summary().textContent}`);
await act(async()=>root.render(<App/>));await open();const baseline=saved();await click('Novo Projeto');
assert(document.querySelector('main #project-editor-title'));
assert(!document.querySelector('[role="dialog"]'), 'O projeto abre dentro da página principal.');
assert(!document.querySelector('#projects-title'), 'A edição ocupa o lugar da lista de projetos.');
assert(!document.body.textContent?.includes('Já produzido'));
await field('Nome do projeto','Projeto fictício');await click('Criar receita personalizada');await field('Nome da receita','Receita exclusiva');await field('Quantidade para cálculo','2');
await choose('#project-custom-material','Cera aromatizada');assert(document.querySelector('#project-custom-aroma-0'),'Escolher a cera abre o seletor de essências.');
await click('+ Insumo');assert(alerts.pop()?.includes('Escolha um material de Essências'),'Não adiciona a cera sem configurar.');
await act(async()=>(document.querySelector('#project-custom-aroma-0') as HTMLInputElement).focus());const options=[...document.querySelectorAll('li')].map(element=>element.textContent||'');assert(options.some(option=>option.includes('Milk-shake de Chocolate')));assert(!options.some(option=>option.includes('Cera de coco')||option.includes('Essência em ml')),'Filtra por categoria/unidade e preserva receitas virtuais.');
await choose('#project-custom-aroma-0','Milk-shake de Chocolate');await field('Qtd. por receita','100');await click('+ Insumo');await click('Adicionar receita personalizada ao projeto');await tab('Orçamento');preview(78.2);
await addDirect('Vanilla','100');await addDirect('Chocolate','50');await addDirect('Vanilla','100');preview(160.7);
assert(!requirements().textContent?.includes('Escolher em:'));assert(requirements().textContent?.includes('405 g'));
await click('Salvar Projeto');let data=saved();let project=data.projects[0];assert.equal(project.lines[0].customRecipeItems[0].categorySelections.aroma,'Milk-shake de Chocolate');assert.equal(project.directMaterials.length,2);assert.equal(project.directMaterials.find((line:any)=>line.categorySelections.aroma==='Vanilla').quantity,200,'Mesmo aroma soma; aromas diferentes permanecem separados.');
for(const key of Object.keys(fixture).filter(key=>key!=='projects'))assert.deepEqual(data[key],baseline[key],`Planejar preserva ${key}`);
await click('Voltar aos projetos');await openProject('Projeto fictício');const customBlock=document.querySelector<HTMLElement>('[data-project-choice^="project-saved-"]')!;assert(customBlock.textContent?.includes('Milk-shake de Chocolate'),'Reabrir mantém a essência.');await click('Trocar',customBlock);await choose('[data-project-choice^="project-saved-"] input','Vanilla');await tab('Orçamento');preview(140.5);
const chocolateLine=project.directMaterials.find((line:any)=>line.categorySelections.aroma==='Chocolate');const chocolateBlock=document.querySelector(`[data-project-choice="project-direct-saved-${chocolateLine.id}"]`)!.parentElement!.parentElement!;await fill(chocolateBlock.querySelector('select')!,'per_unit');preview(165);
await choose('#project-direct-material','Cera aromatizada');await choose('#project-direct-aroma-0','Mistura variável');assert(document.querySelector('#project-direct-aroma-1'),'Uma essência virtual variável abre a próxima escolha.');await choose('#project-direct-aroma-1','Chocolate');await fill(directSection().querySelector('input[type=number]')!,'100');await click('Adicionar',directSection());preview(214);await click('Salvar Projeto');
data=saved();project=data.projects[0];const nested=project.directMaterials.find((line:any)=>line.categorySelections.aroma==='nested');assert(nested);assert.equal(nested.categorySelections['aroma::nested::part'],'Chocolate');
await act(async()=>root.unmount());root=createRoot(document.querySelector('#root')!);await act(async()=>root.render(<App/>));await open();await openProject('Projeto fictício');await tab('Orçamento');preview(214);assert(!requirements().textContent?.includes('Escolher em:'));assert(requirements().textContent?.includes('540 g'));const nestedSaved=document.querySelector(`[data-project-choice="project-direct-saved-${nested.id}"]`)!;assert(nestedSaved.textContent?.includes('Mistura variável'));assert(nestedSaved.textContent?.includes('Chocolate'));
const beforeCancel=JSON.stringify(saved());await tab('Receitas');const customAgain=document.querySelector<HTMLElement>('[data-project-choice^="project-saved-"]')!;await click('Trocar',customAgain);await choose('[data-project-choice^="project-saved-"] input','Chocolate');await click('Voltar aos projetos');assert.equal(JSON.stringify(saved()),beforeCancel,'Cancelar não altera o projeto nem as escolhas.');
assert.deepEqual(alerts,[]);

const beforeSimulation = saved();
await click('Novo Projeto');
await field('Nome do projeto', 'Comparar cera vegetal');
await click('Criar receita personalizada');
await field('Nome da receita', 'Vela com cera A');
await field('Quantidade para cálculo', '8');
await field('Rende por receita', '2');
await field('Preço de venda estimado por unidade (opcional)', '10');
await click('Material de teste');
await click('Adicionar material de teste');
assert(document.querySelector('[role="alert"]')?.textContent?.includes('Informe o nome'));
await field('Nome do material de teste', 'Cera do fornecedor A');
await field('Categoria (opcional)', 'Ceras');
await field('Unidade na receita', 'g');
await field('Quantidade usada (g)', '200');
await field('Unidade da embalagem', 'kg');
await field('Preço da embalagem (R$)', '40');
await click('Adicionar material de teste');
await click('Adicionar receita personalizada ao projeto');
const recipeA = () => document.querySelector('[aria-label="Vela com cera A"]')!;
const financialValue = (card: Element, label: string) =>
  [...card.querySelectorAll('[aria-label="Resumo de custos e venda"] dt')]
    .find(term => term.textContent?.startsWith(label))?.nextElementSibling?.textContent;
assert.equal(financialValue(recipeA(), 'Custos financeiros'), formatCurrency(4));
assert.equal(financialValue(recipeA(), 'Valor de venda'), formatCurrency(10));
assert.equal(financialValue(recipeA(), 'Lucro bruto'), formatCurrency(6));
assert.equal(financialValue(recipeA(), 'Margem'), '60,0%');
assert(recipeA().textContent?.includes('Custo para 8 un ' + formatCurrency(32)));

await click('Criar receita personalizada');
await field('Nome da receita', 'Vela com cera B');
await click('Material de teste');
await field('Nome do material de teste', 'Cera do fornecedor B');
await field('Preço da embalagem (R$)', '5.5');
await click('Adicionar material de teste');
await click('Adicionar receita personalizada ao projeto');
const recipeB = document.querySelector('[aria-label="Vela com cera B"]')!;
assert.equal(financialValue(recipeB, 'Valor de venda'), 'A definir');
assert.equal(financialValue(recipeB, 'Lucro bruto'), '—');
assert.equal(financialValue(recipeB, 'Margem'), '—');
await tab('Orçamento');preview(0);await tab('Receitas');

const catalogProduct = beforeSimulation.products[0];
const catalogCost = catalogProduct.unitCostFromBatch || catalogProduct.totalCost;
const catalogQty = () => document.querySelector<HTMLInputElement>('input[aria-label="Quantidade da receita do catálogo"]')!;
await click('Adicionar do catálogo');
await choose('#project-catalog-recipe', catalogProduct.name);
await fill(catalogQty(), '2');
await click('Adicionar receita');
await choose('#project-catalog-recipe', catalogProduct.name);
await click('Adicionar receita');
assert(document.body.textContent?.includes('3 receitas no projeto'));
assert(document.querySelector('main #project-editor-title'), 'Adicionar uma receita mantém a página aberta.');
await tab('Orçamento');preview(catalogCost * 3);
await click('Salvar Projeto');
assert.deepEqual(saved().materials, beforeSimulation.materials);
const simulations = () => saved().projects.find((value: any) => value.name === 'Comparar cera vegetal');
assert.equal(simulations().lines.length, 3);
assert.deepEqual(simulations().lines.slice(2).map((line: any) => [line.source, line.productId, line.quantity]), [
  ['catalog', catalogProduct.id, 3],
]);
assert.equal(simulations().lines[0].customRecipeItems[0].unitCost, 0.04);

await act(async()=>root.unmount());
root = createRoot(document.querySelector('#root')!);
await act(async()=>root.render(<App/>));
await open();
await openProject('Comparar cera vegetal');
assert(document.querySelector('main #project-editor-title'));
assert(!document.querySelector('[role="dialog"]'));
for (const name of ['Vela com cera A', 'Vela com cera B', catalogProduct.name]) {
  assert([...document.querySelectorAll('[role="group"]')].some(group => group.getAttribute('aria-label') === name), name);
}
await click('Editar receita', recipeA());
const editQuote = document.querySelector<HTMLButtonElement>('[aria-label="Editar cotação de Cera do fornecedor A"]')!;
await act(async () => editQuote.click());
await field('Preço da embalagem (R$)', '35');
await click('Atualizar material de teste');
await click('Salvar receita no projeto');
assert.equal(financialValue(recipeA(), 'Custos financeiros'), formatCurrency(3.5));
assert.equal(financialValue(recipeA(), 'Lucro bruto'), formatCurrency(6.5));
assert.equal(financialValue(recipeA(), 'Margem'), '65,0%');
assert(recipeA().textContent?.includes('Custo para 8 un ' + formatCurrency(28)));

confirmApproval = false;
await click('Aprovar receita', recipeA());
assert.deepEqual(saved().materials, beforeSimulation.materials);
assert.equal(simulations().lines[0].customRecipeItems[0].materialQuote.packagePrice, 40);
confirmApproval = true;
await click('Aprovar receita', recipeA());

const approved = simulations().lines[0];
assert(approved.approvedAt);
const ingredientA = approved.customRecipeItems[0];
assert.equal(ingredientA.materialQuote, undefined);
assert.equal(formatCurrency(ingredientA.totalCost), formatCurrency(7));
assert.equal(simulations().lines[1].customRecipeItems[0].materialQuote.packagePrice, 5.5);
const materialA = saved().materials.find((value: any) => value.id === ingredientA.targetId);
assert.deepEqual(
  [materialA.name, materialA.category, materialA.unit, materialA.packageUnit, materialA.packageQuantity, materialA.packagePrice, materialA.unitCost, materialA.currentStock],
  ['Cera do fornecedor A', 'Ceras', 'g', 'kg', 1, 35, 0.035, 0],
);
assert(!saved().materials.some((value: any) => value.name === 'Cera do fornecedor B'));
for (const key of ['products', 'purchases', 'productions', 'stockMovements', 'finance']) {
  assert.deepEqual(saved()[key], beforeSimulation[key], `Aprovação preserva ${key}`);
}

assert(recipeA().textContent?.includes('Aprovada'));
assert(!recipeA().textContent?.includes('Aprovar receita'));
await tab('Orçamento');
preview(28 + catalogCost * 3);
await click('Salvar Projeto');
assert.equal(saved().materials.filter((value: any) => value.name === 'Cera do fornecedor A').length, 1);
await click('Voltar aos projetos');
assert(!document.querySelector('#project-editor-title'));
assert(document.body.textContent?.includes('Comparar cera vegetal'));
assert.equal(simulations().lines.length, 3);
await openProject('Comparar cera vegetal');
await tab('Análise');
const analysis = document.querySelector('[aria-labelledby="project-analysis-title"]')!;
assert(analysis.textContent?.includes('Vela com cera A'));
assert(analysis.textContent?.includes('Vela com cera B'));
assert(analysis.textContent?.includes('65,0%'));
await tab('Receitas');
assert.equal(financialValue(recipeA(), 'Valor de venda'), formatCurrency(10));

async function clickLabel(label: string) {
  const button = [...document.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === label);
  assert(button, label);
  await act(async () => button.click());
}
const recipeCard = (name: string) => [...document.querySelectorAll('[role="group"]')]
  .find(element => element.getAttribute('aria-label') === name)!;
const originalLines = structuredClone(simulations().lines);
const catalogCopyName = catalogProduct.name + ' (cópia)';
const copiedCatalogCard = () => recipeCard(catalogCopyName);

await clickLabel('Duplicar receita ' + catalogProduct.name);
const composer = document.querySelector('[aria-label="Editar receita personalizada"]')!;
assert(composer.querySelector('input')?.value.endsWith('(cópia)'));
assert.equal(fieldInput('Tempo de produção por lote (min)').value, '15');
assert.equal(fieldInput('Valor da hora (R$/h)').value, '40');
assert.equal(fieldInput('Custos fixos (%)').value, '5');
await click('Salvar receita no projeto');
assert(copiedCatalogCard().textContent?.includes('Simulação'));
for (const term of ['Custos financeiros', 'Custos + mão de obra', 'Valor de venda', 'Lucro bruto', 'Margem']) {
  assert.equal(financialValue(copiedCatalogCard(), term), financialValue(recipeCard(catalogProduct.name), term), term);
}
await tab('Orçamento');preview(28 + catalogCost * 3);await tab('Receitas');

await click('Editar receita', copiedCatalogCard());
await clickLabel('Trocar insumo Cera aromatizada');
await click('Material de teste');
await field('Nome do material de teste', 'Cera de outra marca');
await field('Preço da embalagem (R$)', '0.2');
await click('Atualizar material de teste');
await click('Salvar receita no projeto');
assert.notEqual(financialValue(copiedCatalogCard(), 'Custos financeiros'), financialValue(recipeCard(catalogProduct.name), 'Custos financeiros'));
await tab('Orçamento');preview(28 + catalogCost * 3);await tab('Receitas');

await clickLabel('Duplicar receita Vela com cera B');
await clickLabel('Editar cotação de Cera do fornecedor B');
await field('Preço da embalagem (R$)', '6.5');
await click('Atualizar material de teste');
await click('Salvar receita no projeto');
await click('Salvar Projeto');
assert.deepEqual(simulations().lines.slice(0, 3), originalLines);
const [, originalB, , catalogCopy, quoteCopy] = simulations().lines;
assert(catalogCopy.isSimulation && quoteCopy.isSimulation);
assert.equal(catalogCopy.producedQuantity, 0);
assert.equal(catalogCopy.recipePricing.productionTimeMinutes, 15);
assert.equal(catalogCopy.customRecipeItems[0].quantity, catalogProduct.items[0].quantity);
assert.equal(catalogCopy.customRecipeItems[0].unit, 'g');
assert.equal(catalogCopy.customRecipeItems[0].materialQuote.packagePrice, 0.2);
assert.equal(quoteCopy.customRecipeItems[0].materialQuote.packagePrice, 6.5);
assert.notEqual(quoteCopy.customRecipeItems[0].targetId, originalB.customRecipeItems[0].targetId);
assert(!saved().materials.some((value: any) => value.name === 'Cera de outra marca'));
await tab('Orçamento');
assert(!document.querySelector('input[aria-label="Incluir Vela com cera B no orçamento"]'));
const catalogOption = [...document.querySelectorAll('input[type="checkbox"]')].find(input => input.getAttribute('aria-label') === `Incluir ${catalogProduct.name} no orçamento`) as HTMLInputElement;
assert(catalogOption.checked);
await act(async () => catalogOption.click());
preview(28);
assert(summary().textContent?.includes(formatCurrency(80)));
await click('Salvar Projeto');
assert(document.querySelector('[role="status"]')?.textContent?.includes('Projeto salvo'));
await click('Voltar aos projetos');
await openProject('Comparar cera vegetal');
await tab('Orçamento');
preview(28);
assert.equal(simulations().lines[2].excludedFromBudget, true);
assert.equal(simulations().lines.length, 5);

await tab('Receitas');
await click('Editar receita', recipeA());
await field('Tempo de produção por lote (min)', '12');
await field('Valor da hora (R$/h)', '-30');
await click('Salvar receita no projeto');
assert(alerts.pop()?.includes('valores válidos a partir de zero'));
await field('Valor da hora (R$/h)', '30');
await field('Custos fixos (%)', '10');
assert(document.querySelector('[aria-label="Editar receita personalizada"]')?.textContent?.includes(formatCurrency(7.15)));
await click('Salvar receita no projeto');
const bannerProfit = (card: Element) => [...card.querySelectorAll('dl dt')]
  .find(term => term.textContent === 'Lucro bruto por un.')?.nextElementSibling?.textContent;
assert.equal(bannerProfit(recipeA()), formatCurrency(5.85));
assert.equal(bannerProfit(recipeCard('Vela com cera B')), '—');
assert.equal(financialValue(recipeA(), 'Custos + mão de obra'), formatCurrency(7.15));
assert.equal(financialValue(recipeA(), 'Margem'), '58,5%');
await tab('Orçamento');
preview(57.2);
await click('Salvar Projeto');
assert.deepEqual(simulations().lines[0].recipePricing, {
  productionTimeMinutes: 12, hourlyRate: 30, fixedCostPercent: 10, otherCosts: 0,
});
await click('Voltar aos projetos');
await openProject('Comparar cera vegetal');
assert.equal(bannerProfit(recipeA()), formatCurrency(5.85));
await click('Editar receita', recipeA());
assert.equal(fieldInput('Tempo de produção por lote (min)').value, '12');
assert.equal(fieldInput('Valor da hora (R$/h)').value, '30');
assert.equal(fieldInput('Custos fixos (%)').value, '10');
assert.deepEqual(alerts, []);
await act(async()=>root.unmount());
console.log('Duplicação em Projetos: mantém a análise da original, troca insumo por cotação, edita cotação copiada, persiste como simulação e preserva as receitas de origem.');
console.log('Página de projetos: nova e edição sem diálogo, inclui receitas do catálogo e personalizadas, soma a mesma receita, salva, recarrega e volta à lista.');
console.log('Simulação de receitas: cotação por kg em receita em gramas, custo por peça, escolha entre opções, reabertura, alteração, aprovação e cadastro sem estoque ou compra.');
console.log('Projetos: seletor de essências na receita personalizada e material direto, validação, fórmulas virtuais/nested, custos e insumos, separação por aroma, edição, cancelamento e persistência sem movimentar estoque passaram.');
process.exit(0);
