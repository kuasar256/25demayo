import { useState } from 'react';
import { Printer, MessageCircle, X, CheckCircle2 } from 'lucide-react';

export interface SaleTicketData {
  code: string;
  createdAt: string;
  locationName?: string;
  sellerName?: string;
  clientName: string;
  clientCi: string;
  clientPhone?: string;
  paymentMethod: string;
  amountPaid?: number;
  changeAmount?: number;
  total: number;
  items: Array<{
    name: string;
    size?: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

interface SaleTicketModalProps {
  sale: SaleTicketData;
  onClose: () => void;
}

export function SaleTicketModal({ sale, onClose }: SaleTicketModalProps) {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    if (!sale.clientPhone) {
      alert('El cliente no tiene un teléfono registrado.');
      return;
    }
    const cleanPhone = sale.clientPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 8 ? `591${cleanPhone}` : cleanPhone;

    const itemsSummary = sale.items
      .map((it) => `• ${it.quantity}x ${it.name} (${it.size || it.sku}) - Bs ${(it.quantity * it.unitPrice).toFixed(2)}`)
      .join('%0A');

    const msg = `*COLCHONES 25 DE MAYO*%0A` +
      `¡Gracias por su compra, *${sale.clientName}*!%0A%0A` +
      `*Comprobante:* ${sale.code}%0A` +
      `*Fecha:* ${new Date(sale.createdAt).toLocaleDateString('es-BO')}%0A` +
      `*Método de Pago:* ${sale.paymentMethod}%0A%0A` +
      `*Detalle:*%0A${itemsSummary}%0A%0A` +
      `*TOTAL:* Bs ${sale.total.toFixed(2)}%0A%0A` +
      `_Conserve este mensaje como comprobante de su garantía oficial._`;

    window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Estilos específicos para impresión térmica (80mm) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-ticket, #thermal-ticket * {
            visibility: visible;
          }
          #thermal-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 78mm;
            padding: 4mm;
            margin: 0;
            background: white !important;
            color: black !important;
            font-size: 11px !important;
            font-family: monospace !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-line flex flex-col max-h-[95vh]">
        {/* Cabecera modal */}
        <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="font-bold text-base">Venta Registrada con Éxito</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-emerald-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vista previa del ticket */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950/40">
          <div
            id="thermal-ticket"
            className="bg-white text-slate-800 p-5 rounded-xl border border-slate-200 shadow-sm mx-auto font-mono text-xs max-w-[320px]"
          >
            {/* Header ticket */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h2 className="font-bold text-sm tracking-wide text-slate-900">COLCHONES 25 DE MAYO</h2>
              <p className="text-[10px] text-slate-500">Fábrica y Venta de Colchones & Catres</p>
              <p className="text-[10px] text-slate-500">La Paz - El Alto, Bolivia</p>
              <p className="mt-1 font-semibold text-slate-700">COMPROBANTE DE VENTA</p>
              <p className="text-slate-600 font-bold">{sale.code}</p>
            </div>

            {/* Datos de venta */}
            <div className="py-2.5 text-[11px] border-b border-dashed border-slate-300 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha:</span>
                <span>{new Date(sale.createdAt).toLocaleString('es-BO')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-medium text-right truncate max-w-[170px]">{sale.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CI / NIT:</span>
                <span>{sale.clientCi}</span>
              </div>
              {sale.sellerName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Atendido por:</span>
                  <span>{sale.sellerName}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="py-2.5 border-b border-dashed border-slate-300">
              <div className="flex justify-between font-bold text-[10px] text-slate-500 mb-1">
                <span>DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {sale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-1">
                    <div>
                      <div className="font-semibold text-slate-900">{it.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {it.quantity} x Bs {it.unitPrice.toFixed(2)}
                      </div>
                    </div>
                    <span className="font-semibold whitespace-nowrap">
                      Bs {(it.quantity * it.unitPrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales y Pago */}
            <div className="pt-2.5 space-y-1 text-[11px]">
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-300">
                <span>TOTAL A PAGAR:</span>
                <span>Bs {sale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Método de Pago:</span>
                <span className="font-medium">{sale.paymentMethod}</span>
              </div>
              {sale.paymentMethod === 'EFECTIVO' && sale.amountPaid !== undefined && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Efectivo Recibido:</span>
                    <span>Bs {Number(sale.amountPaid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Cambio / Vuelto:</span>
                    <span>Bs {Number(sale.changeAmount || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Pie de ticket */}
            <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500 space-y-1">
              <p>¡Gracias por elegir Colchones 25 de Mayo!</p>
              <p className="font-semibold text-slate-700">Calidad y descanso garantizado</p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-line flex flex-col sm:flex-row gap-2 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium hover:opacity-90 transition-opacity text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir Ticket (80mm)
          </button>

          {sale.clientPhone && (
            <button
              onClick={handleSendWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar WhatsApp
            </button>
          )}

          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-line text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
