import records1 from './catalog-data-1';
import records2 from './catalog-data-2';
import records3 from './catalog-data-3';
import records4 from './catalog-data-4';
import records5 from './catalog-data-5';
import records6 from './catalog-data-6';
import records7 from './catalog-data-7';
import records8 from './catalog-data-8';

export type CatalogProduct={id:string,sku:string,supplierSku:string,name:string,series:string,category:string,subcategory:string,module:string,technology:string,material:string,finish:string,sellingPrice:number,purchaseCost:number,warranty:string,source:string,sourceSheet?:string,sourcePage?:number,image:string,description:string,hsn:string,gst:number};

export const catalog = [...records1,...records2,...records3,...records4,...records5,...records6,...records7,...records8] as CatalogProduct[];
