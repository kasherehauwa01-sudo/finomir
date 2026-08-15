from decimal import Decimal
ZERO=Decimal("0.00")
def invoice_totals(amount:Decimal,payments:list[Decimal])->tuple[Decimal,Decimal]:
 paid=sum(payments,ZERO); return paid,amount-paid
def expense_totals(invoices:list[tuple[Decimal,list[Decimal]]])->tuple[Decimal,Decimal,Decimal]:
 total=sum((x[0] for x in invoices),ZERO); paid=sum((sum(x[1],ZERO) for x in invoices),ZERO); return total,paid,total-paid
def allocation_totals(invoice_total:Decimal, allocations:list[Decimal])->tuple[Decimal,Decimal]:
 allocated=sum(allocations,ZERO); return allocated,invoice_total-allocated
