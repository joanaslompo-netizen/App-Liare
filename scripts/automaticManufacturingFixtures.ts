import { DEFAULT_PRODUCTS, DEFAULT_MATERIALS } from '../src/utils/storage';
import type { Material, Product, RecipeItem } from '../src/types';
export const ingredient = (id: string, type: 'material'|'product', quantity: number): RecipeItem => ({id:`line_${id}`,targetId:id,type,quantity,name:id,unit:type==='product'?'un':'g',unitCost:1,totalCost:quantity});
export const autoMaterials: Material[] = [
  {...DEFAULT_MATERIALS[0],id:'wax',name:'Cera',unit:'g',unitCost:1,currentStock:100},
  {...DEFAULT_MATERIALS[0],id:'aroma',name:'Essência',unit:'g',unitCost:1,currentStock:100},
  {...DEFAULT_MATERIALS[0],id:'blend',name:'Mistura pronta',unit:'g',unitCost:1,currentStock:20,isMadeInAtelier:true,batchYield:100,recipeItems:[ingredient('wax','material',90),ingredient('aroma','material',10)],productionTimeMinutes:0,recipeFixedCostPercent:0,recipeOtherCosts:0},
];
export const autoProducts: Product[] = [
  {...DEFAULT_PRODUCTS[0],id:'decoration',name:'Decoração',items:[ingredient('blend','material',100)],currentStock:1,batchYield:10,totalCost:100,materialsCost:100,laborCost:0,fixedCost:0,otherCosts:0,isIntermediate:true,useProductionStages:false},
  {...DEFAULT_PRODUCTS[0],id:'candle',name:'Vela teste',items:[ingredient('decoration','product',2),ingredient('blend','material',50)],currentStock:0,batchYield:1,totalCost:70,materialsCost:70,laborCost:0,fixedCost:0,otherCosts:0,isIntermediate:false,useProductionStages:false},
];
