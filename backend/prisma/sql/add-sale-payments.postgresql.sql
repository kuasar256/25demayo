-- Additive upgrade only: existing sales and historical cash records are not changed.
CREATE TABLE IF NOT EXISTS "SalePayment" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "cashShiftId" INTEGER,
  "userId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'INITIAL',
  "paymentMethod" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalePayment_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SalePayment_saleId_idx" ON "SalePayment"("saleId");
CREATE INDEX IF NOT EXISTS "SalePayment_cashShiftId_idx" ON "SalePayment"("cashShiftId");
