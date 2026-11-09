import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { workspaceStorage } from '../src/utils/workspaceStorage';
import { ingredient, virtualFragranceWorkspace } from './virtualFragranceFixtures';
import { formatCurrency } from '../src/utils/formatters';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','localStorage']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const alerts:string[]=[];
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,alert:(message:string)=>alerts.push(message),confirm:()=>true,requestAnimationFrame:(fn:()=>void)=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};dom.window.scrollTo=()=>{};
const fixture=virtualFragranceWorkspace();
fixture.materials.push({...fixture.materials[1],id:'nested',name:'Mistura variável',isVirtualRecipe:true,isMadeInAtelier:true,batchYield:100,recipeItems:[{...ingredient('part','category:Essências',100),selectionMode:'category',targetCategory:'Essências'}]}, {...fixture.materials[1],id:'wrong-unit',name:'Essência em ml',unit:'ml'});
workspaceStorage.setItem('atelie_workspace_finance_v1',JSON.stringify(fixture));
const {createRoot}=await import('react-dom/client');const {default:App}=await import('../src/App');
let root=createRoot(document.querySelector('#root')!);
const saved=()=>JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!);
async function click(text:string,scope:ParentNode=document){const element=[...scope.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.trim()===text);assert(element,text);await act(async()=>element.click());}
async function fill(element:HTMLInputElement|HTMLSelectElement,value:string){assert(element,'Campo encontrado');await act(async()=>{const proto=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function field(label:string,value:string){const container=[...document.querySelectorAll('label')].find(element=>element.firstChild?.textContent?.trim()===label);assert(container,label);await fill(container.querySelector('input,select') as HTMLInputElement,value);}
async function choose(selector:string,name:string){const input=document.querySelector<HTMLInputElement>(selector);assert(input,selector);await act(async()=>input.focus());const option=[...document.querySelectorAll('li')].find(element=>element.textContent?.includes(name));assert(option,name);await act(async()=>option.click());}
async function open(){await act(async()=>(document.querySelector('[aria-label="Abrir atalhos rápidos"]') as HTMLButtonElement).click());await click('Projetos');}
const directSection=()=>[...document.querySelectorAll('section')].find(section=>section.querySelector('h4')?.textContent==='Materiais do projeto')!;
async function addDirect(aroma:string,quantity:string){await choose('#project-direct-material','Cera aromatizada');await choose('#project-direct-aroma-0',aroma);await fill(directSection().querySelector('input[type=number]')!,quantity);await click('Adicionar',directSection());}
const summary=()=>[...document.querySelectorAll('section')].find(section=>section.querySelector('h4')?.textContent==='Resumo do planejamento')!;
const preview=(cost:number)=>assert(summary().textContent?.includes(formatCurrency(cost)),`Custo previsto ${cost}: ${summary().textContent}`);
await act(async()=>root.render(<App/>));await open();const baseline=saved();await click('Novo Projeto');await field('Nome do projeto','Projeto fictício');await click('Receita personalizada');await field('Nome da receita','Receita exclusiva');await field('Produzir','2');
await choose('#project-custom-material','Cera aromatizada');assert(document.querySelector('#project-custom-aroma-0'),'Escolher a cera abre o seletor de essências.');
await click('+ Insumo');assert(alerts.pop()?.includes('Escolha um material de Essências'),'Não adiciona a cera sem configurar.');
await act(async()=>(document.querySelector('#project-custom-aroma-0') as HTMLInputElement).focus());const options=[...document.querySelectorAll('li')].map(element=>element.textContent||'');assert(options.some(option=>option.includes('Milk-shake de Chocolate')));assert(!options.some(option=>option.includes('Cera de coco')||option.includes('Essência em ml')),'Filtra por categoria/unidade e preserva receitas virtuais.');
await choose('#project-custom-aroma-0','Milk-shake de Chocolate');await field('Qtd. por receita','100');await click('+ Insumo');await click('Adicionar receita personalizada ao projeto');preview(78.2);
await addDirect('Vanilla','100');await addDirect('Chocolate','50');await addDirect('Vanilla','100');preview(160.7);
assert(!summary().textContent?.includes('Escolher em:'));assert(summary().textContent?.includes('405 g'));
await click('Salvar Projeto');let data=saved();let project=data.projects[0];assert.equal(project.lines[0].customRecipeItems[0].categorySelections.aroma,'Milk-shake de Chocolate');assert.equal(project.directMaterials.length,2);assert.equal(project.directMaterials.find((line:any)=>line.categorySelections.aroma==='Vanilla').quantity,200,'Mesmo aroma soma; aromas diferentes permanecem separados.');
for(const key of Object.keys(fixture).filter(key=>key!=='projects'))assert.deepEqual(data[key],baseline[key],`Planejar preserva ${key}`);
await click('Editar');const customBlock=document.querySelector<HTMLElement>('[data-project-choice^="project-saved-"]')!;assert(customBlock.textContent?.includes('Milk-shake de Chocolate'),'Reabrir mantém a essência.');await click('Trocar',customBlock);await choose('[data-project-choice^="project-saved-"] input','Vanilla');preview(140.5);
const chocolateLine=project.directMaterials.find((line:any)=>line.categorySelections.aroma==='Chocolate');const chocolateBlock=document.querySelector(`[data-project-choice="project-direct-saved-${chocolateLine.id}"]`)!.parentElement!.parentElement!;await fill(chocolateBlock.querySelector('select')!,'per_unit');preview(165);
await choose('#project-direct-material','Cera aromatizada');await choose('#project-direct-aroma-0','Mistura variável');assert(document.querySelector('#project-direct-aroma-1'),'Uma essência virtual variável abre a próxima escolha.');await choose('#project-direct-aroma-1','Chocolate');await fill(directSection().querySelector('input[type=number]')!,'100');await click('Adicionar',directSection());preview(214);await click('Salvar Projeto');
data=saved();project=data.projects[0];const nested=project.directMaterials.find((line:any)=>line.categorySelections.aroma==='nested');assert(nested);assert.equal(nested.categorySelections['aroma::nested::part'],'Chocolate');
await act(async()=>root.unmount());root=createRoot(document.querySelector('#root')!);await act(async()=>root.render(<App/>));await open();await click('Editar');preview(214);assert(!summary().textContent?.includes('Escolher em:'));assert(summary().textContent?.includes('540 g'));const nestedSaved=document.querySelector(`[data-project-choice="project-direct-saved-${nested.id}"]`)!;assert(nestedSaved.textContent?.includes('Mistura variável'));assert(nestedSaved.textContent?.includes('Chocolate'));
const beforeCancel=JSON.stringify(saved());const customAgain=document.querySelector<HTMLElement>('[data-project-choice^="project-saved-"]')!;await click('Trocar',customAgain);await choose('[data-project-choice^="project-saved-"] input','Chocolate');await click('Cancelar');assert.equal(JSON.stringify(saved()),beforeCancel,'Cancelar não altera o projeto nem as escolhas.');
assert.deepEqual(alerts,[]);await act(async()=>root.unmount());
console.log('Projetos: seletor de essências na receita personalizada e material direto, validação, fórmulas virtuais/nested, custos e insumos, separação por aroma, edição, cancelamento e persistência sem movimentar estoque passaram.');
process.exit(0);
