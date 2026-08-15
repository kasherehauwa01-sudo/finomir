export const money=(value:string|number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:Number(value)%1?2:0}).format(Number(value));
export const dateRu=(value:string)=>new Intl.DateTimeFormat('ru-RU').format(new Date(value));
