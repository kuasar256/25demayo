const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function cashSummary(shift: any) {
  const payments = shift.payments ?? [];
  const legacySales = shift.sales.filter((sale: any) => !sale.payments?.some((p: any) => p.kind === 'INITIAL'));
  // Historical records do not identify all payment methods/turns reliably.
  // Show an estimate explicitly and require reconciliation before closing.
  const needsReconciliation = legacySales.length > 0;
  const receipts = [...payments, ...legacySales.map((sale: any) => ({
    paymentMethod: sale.paymentMethod || 'EFECTIVO', amount: Math.min(sale.total, sale.amountPaid ?? sale.total),
  }))];
  const total = (method: string) => money(receipts.filter(p => p.paymentMethod === method).reduce((sum, p) => sum + p.amount, 0));
  const manual = (type: string) => money(shift.movements.filter((m: any) => m.type === type).reduce((sum: number, m: any) => sum + m.amount, 0));
  const totalCashSales = total('EFECTIVO'), totalQrSales = total('QR'), totalCardSales = total('TARJETA'), totalOtherSales = total('MIXTO');
  const totalInflow = manual('ENTRADA'), totalOutflow = manual('SALIDA');
  return { initialCash: shift.initialCash, totalCashSales, totalQrSales, totalCardSales, totalOtherSales,
    totalSales: money(totalCashSales + totalQrSales + totalCardSales + totalOtherSales), salesCount: shift.sales.length,
    totalInflow, totalOutflow, expectedCash: money(shift.initialCash + totalCashSales + totalInflow - totalOutflow), needsReconciliation };
}
