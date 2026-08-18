from decimal import Decimal, ROUND_DOWN
ZERO=Decimal("0.00")
def invoice_totals(amount:Decimal,payments:list[Decimal])->tuple[Decimal,Decimal]:
 paid=sum(payments,ZERO); return paid,amount-paid
def expense_totals(invoices:list[tuple[Decimal,list[Decimal]]])->tuple[Decimal,Decimal,Decimal]:
 total=sum((x[0] for x in invoices),ZERO); paid=sum((sum(x[1],ZERO) for x in invoices),ZERO); return total,paid,total-paid
def allocation_totals(invoice_total:Decimal, allocations:list[Decimal])->tuple[Decimal,Decimal]:
 allocated=sum(allocations,ZERO); return allocated,invoice_total-allocated
def distribute_evenly(amount:Decimal,count:int)->list[Decimal]:
 if count<=0: return []
 cents=int((amount.quantize(Decimal("0.01"),rounding=ROUND_DOWN)*100).to_integral_value())
 base,remainder=divmod(cents,count)
 return [Decimal(base+(1 if index<remainder else 0))/100 for index in range(count)]
