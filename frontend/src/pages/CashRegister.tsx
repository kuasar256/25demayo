import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  History,
  Lock,
  Unlock,
  DollarSign,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function CashRegisterPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Modales
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Form states
  const [initialCash, setInitialCash] = useState<string>('0');
  const [moveType, setMoveType] = useState<'ENTRADA' | 'SALIDA'>('SALIDA');
  const [moveAmount, setMoveAmount] = useState<string>('');
  const [moveReason, setMoveReason] = useState<string>('');
  const [actualCash, setActualCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState<string>('');

  // 1. Consultar turno activo
  const {
    data: activeShift,
    isLoading: loadingActive,
    isError: errorActive,
  } = useQuery({
    queryKey: ['cash-register', 'active'],
    queryFn: async () => (await api.get('/cash-register/active')).data,
    refetchInterval: 15_000,
  });

  // 2. Consultar historial
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['cash-register', 'history'],
    queryFn: async () => (await api.get('/cash-register/history')).data,
  });

  // Mutación: Abrir Caja
  const mutOpen = useMutation({
    mutationFn: async (amount: number) => {
      const res = await api.post('/cash-register/open', { initialCash: amount });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Turno de caja abierto correctamente');
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      setShowOpenModal(false);
      setInitialCash('0');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al abrir caja');
    },
  });

  // Mutación: Movimiento de Caja
  const mutMovement = useMutation({
    mutationFn: async (payload: { shiftId: number; type: 'ENTRADA' | 'SALIDA'; amount: number; reason: string }) => {
      const res = await api.post(`/cash-register/${payload.shiftId}/movement`, {
        type: payload.type,
        amount: payload.amount,
        reason: payload.reason,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Movimiento registrado en caja');
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      setShowMoveModal(false);
      setMoveAmount('');
      setMoveReason('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar movimiento');
    },
  });

  // Mutación: Cierre de Caja
  const mutClose = useMutation({
    mutationFn: async (payload: { shiftId: number; actualCash: number; notes?: string }) => {
      const res = await api.post(`/cash-register/${payload.shiftId}/close`, {
        actualCash: payload.actualCash,
        notes: payload.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Caja cerrada con éxito');
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      setShowCloseModal(false);
      setActualCash('');
      setCloseNotes('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al cerrar caja');
    },
  });

  const summary = activeShift?.summary;
  const receipts = activeShift?.payments ?? [];
  const receiptTotal = receipts.reduce((sum: number, payment: any) => sum + payment.amount, 0);

  return (
    <div className="space-y-6">
      {summary?.needsReconciliation && <p role="alert" className="rounded-lg border border-warning bg-warning/10 p-3 text-sm">Esta caja contiene cobros históricos sin desglose de medio y turno. Los importes son orientativos y requieren conciliación antes del cierre.</p>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" />
            Control de Caja y Arqueo Diario
          </h1>
          <p className="text-sm text-muted">
            Gestiona la apertura, ingresos/egresos menores y el cuadre ciego al final del turno.
          </p>
        </div>

        {activeShift ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMoveModal(true)}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <DollarSign className="w-4 h-4" />
              Movimiento Menor
            </button>
            <button
              onClick={() => setShowCloseModal(true)}
              className="btn-primary bg-amber-600 hover:bg-amber-700 flex items-center gap-1.5 text-sm"
            >
              <Lock className="w-4 h-4" />
              Arqueo y Cierre
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowOpenModal(true)}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Unlock className="w-4 h-4" />
            Abrir Turno de Caja
          </button>
        )}
      </div>

      {/* ESTADO DE CAJA ACTUAL */}
      {loadingActive ? (
        <div className="card p-8 text-center text-muted">Cargando estado de caja...</div>
      ) : activeShift ? (
        <div className="space-y-4">
          {/* Banner de caja abierta */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                  Caja Abierta — {activeShift.branch?.name || 'Turno Personal'}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Abierta por <strong>{activeShift.openedBy?.fullName}</strong> el{' '}
                  {new Date(activeShift.openedAt).toLocaleString('es-BO')}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-muted block">Efectivo Teórico en Gaveta:</span>
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                Bs {summary?.expectedCash.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Tarjetas de Resumen Financiero del Turno */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs text-muted mb-1">Fondo Inicial</p>
              <p className="text-lg font-bold">Bs {summary?.initialCash.toFixed(2)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted mb-1">Cobros en Efectivo</p>
              <p className="text-lg font-bold text-primary">Bs {summary?.totalCashSales.toFixed(2)}</p>
              <span className="text-[11px] text-muted">{summary?.salesCount} ventas totales</span>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted mb-1">Cobros Electrónicos (QR / Tarjeta)</p>
              <p className="text-lg font-bold text-indigo-600">
                Bs {(summary?.totalQrSales + summary?.totalCardSales).toFixed(2)}
              </p>
              <span className="text-[11px] text-muted">
                QR: Bs {summary?.totalQrSales.toFixed(2)} · POS: Bs {summary?.totalCardSales.toFixed(2)}
              </span>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted mb-1">Gastos / Retiros Menores</p>
              <p className="text-lg font-bold text-rose-600">Bs {summary?.totalOutflow.toFixed(2)}</p>
              <span className="text-[11px] text-muted">Ingresos manuales: +Bs {summary?.totalInflow.toFixed(2)}</span>
            </div>
          </div>

          {/* Dos columnas: Movimientos de Caja Chica y Ventas asociadas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Movimientos menores de caja */}
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>Movimientos de Caja Menor (Gastos / Entradas)</span>
                <span className="text-xs text-muted">{activeShift.movements.length} regs</span>
              </h3>

              {activeShift.movements.length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">No hay gastos ni ingresos menores registrados hoy.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activeShift.movements.map((m: any) => (
                    <div
                      key={m.id}
                      className="flex justify-between items-center p-2.5 rounded-lg border border-line text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {m.type === 'ENTRADA' ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-rose-600" />
                        )}
                        <div>
                          <p className="font-medium">{m.reason}</p>
                          <span className="text-[10px] text-muted">
                            {new Date(m.createdAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <span className={`font-bold ${m.type === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.type === 'ENTRADA' ? '+' : '-'}Bs {m.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cobros registrados en este turno */}
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>Cobros Desglosados en este Turno</span>
                <span className="text-xs font-bold text-primary">Bs {receiptTotal.toFixed(2)}</span>
              </h3>

              {receipts.length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">Aún no hay cobros desglosados en este turno.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {receipts.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex justify-between items-center p-2.5 rounded-lg border border-line text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-muted" />
                        <div>
                          <p className="font-medium">Venta #{s.saleId} · {s.kind === 'BALANCE' ? 'Saldo' : 'Cobro inicial'}</p>
                          <span className="text-[10px] text-muted">
                            {new Date(s.createdAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })} · {s.paymentMethod || 'EFECTIVO'}
                          </span>
                        </div>
                      </div>
                      <span className="font-bold text-primary">Bs {s.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center border-dashed border-2">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold mb-1">No hay turno de caja abierto</h3>
          <p className="text-sm text-muted max-w-md mx-auto mb-5">
            Abre un turno con tu fondo de caja inicial para comenzar a cobrar ventas y registrar gastos del día.
          </p>
          <button onClick={() => setShowOpenModal(true)} className="btn-primary text-sm px-6 py-2.5">
            Abrir Caja Ahora
          </button>
        </div>
      )}

      {/* HISTORIAL DE TURNOS ANTERIORES */}
      <div className="card p-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <History className="w-5 h-5 text-muted" />
          Historial de Cierres y Arqueos
        </h3>

        {loadingHistory ? (
          <p className="text-xs text-muted">Cargando historial...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted">No hay turnos cerrados registrados todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2.5">Fecha / Turno</th>
                  <th className="py-2.5">Sucursal</th>
                  <th className="py-2.5">Responsables</th>
                  <th className="py-2.5 text-right">Fondo Inicial</th>
                  <th className="py-2.5 text-right">Efectivo Esperado</th>
                  <th className="py-2.5 text-right">Efectivo Contado</th>
                  <th className="py-2.5 text-right">Diferencia / Cuadre</th>
                  <th className="py-2.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => {
                  const diff = h.difference ?? 0;
                  return (
                    <tr key={h.id} className="border-b border-line/60 hover:bg-page/50">
                      <td className="py-2.5">
                        <span className="font-medium block">{new Date(h.openedAt).toLocaleDateString('es-BO')}</span>
                        <span className="text-[10px] text-muted">
                          {new Date(h.openedAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}{' '}
                          →{' '}
                          {h.closedAt
                            ? new Date(h.closedAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
                            : 'En curso'}
                        </span>
                      </td>
                      <td className="py-2.5">{h.branch?.name || 'General'}</td>
                      <td className="py-2.5">
                        <span className="block font-medium">{h.openedBy?.fullName}</span>
                        {h.closedBy && (
                          <span className="text-[10px] text-muted">Cerró: {h.closedBy?.fullName}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">Bs {h.initialCash.toFixed(2)}</td>
                      <td className="py-2.5 text-right">
                        {h.expectedCash !== null ? `Bs ${h.expectedCash.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        {h.actualCash !== null ? `Bs ${h.actualCash.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-bold">
                        {h.difference === null ? (
                          '—'
                        ) : diff === 0 ? (
                          <span className="text-emerald-600">Exacto (Bs 0.00)</span>
                        ) : diff > 0 ? (
                          <span className="text-emerald-600">+Bs {diff.toFixed(2)} (Sobrante)</span>
                        ) : (
                          <span className="text-rose-600">-Bs {Math.abs(diff).toFixed(2)} (Faltante)</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            h.status === 'ABIERTA'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: APERTURA DE CAJA */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 border border-line shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Apertura de Turno de Caja</h3>
            <p className="text-xs text-muted mb-4">
              Ingresa el fondo de cambio inicial asignado a la gaveta de cobro.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutOpen.mutate(parseFloat(initialCash) || 0);
              }}
              className="space-y-4"
            >
              <div>
                <label className="label">Fondo de Cambio Inicial (Bs)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  className="input text-lg font-bold text-center"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutOpen.isPending}
                  className="btn-primary text-xs"
                >
                  {mutOpen.isPending ? 'Abriendo...' : 'Confirmar Apertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MOVIMIENTO MENOR */}
      {showMoveModal && activeShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 border border-line shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Movimiento de Caja Menor</h3>
            <p className="text-xs text-muted mb-4">Registra salidas (gastos) o ingresos menores no relacionados a ventas.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!moveReason.trim()) return toast.error('Ingresa el motivo');
                const amt = parseFloat(moveAmount);
                if (!amt || amt <= 0) return toast.error('Monto inválido');
                mutMovement.mutate({
                  shiftId: activeShift.id,
                  type: moveType,
                  amount: amt,
                  reason: moveReason.trim(),
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMoveType('SALIDA')}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    moveType === 'SALIDA' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'border-line text-muted'
                  }`}
                >
                  Salida (Gasto)
                </button>
                <button
                  type="button"
                  onClick={() => setMoveType('ENTRADA')}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    moveType === 'ENTRADA' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-line text-muted'
                  }`}
                >
                  Entrada (Ingreso)
                </button>
              </div>

              <div>
                <label className="label">Monto (Bs)</label>
                <input
                  type="number"
                  step="any"
                  min="0.5"
                  required
                  placeholder="0.00"
                  value={moveAmount}
                  onChange={(e) => setMoveAmount(e.target.value)}
                  className="input font-bold"
                />
              </div>

              <div>
                <label className="label">Motivo / Concepto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Limpieza, taxi envío urgente, etc."
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowMoveModal(false)} className="btn-secondary text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={mutMovement.isPending} className="btn-primary text-xs">
                  {mutMovement.isPending ? 'Guardando...' : 'Guardar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CIERRE Y ARQUEO CIEGO */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-line shadow-2xl">
            <h3 className="text-lg font-bold mb-1">Arqueo y Cierre de Turno</h3>
            <p className="text-xs text-muted mb-4">
              Cuenta el dinero físico que hay actualmente en la gaveta y digítalo a continuación.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const actual = parseFloat(actualCash);
                if (isNaN(actual) || actual < 0) return toast.error('Monto contado inválido');
                mutClose.mutate({
                  shiftId: activeShift.id,
                  actualCash: actual,
                  notes: closeNotes,
                });
              }}
              className="space-y-4"
            >
              <div className="p-3 rounded-xl bg-page border border-line space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Fondo inicial:</span>
                  <span>Bs {summary?.initialCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">+ Cobros en efectivo:</span>
                  <span className="text-primary font-medium">Bs {summary?.totalCashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">+ Ingresos menores:</span>
                  <span className="text-emerald-600">Bs {summary?.totalInflow.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">- Gastos menores:</span>
                  <span className="text-rose-600">Bs {summary?.totalOutflow.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-line text-slate-900 dark:text-slate-100">
                  <span>Efectivo Esperado en Gaveta:</span>
                  <span>Bs {summary?.expectedCash.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="label">Efectivo Físico Contado (Bs)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0.00"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="input text-xl font-bold text-center"
                />
              </div>

              {actualCash !== '' && !isNaN(parseFloat(actualCash)) && (
                <div className="p-2.5 rounded-lg border text-xs text-center font-bold">
                  {parseFloat(actualCash) - summary?.expectedCash === 0 ? (
                    <span className="text-emerald-600">✓ Caja Perfectamente Cuadrada</span>
                  ) : parseFloat(actualCash) - summary?.expectedCash > 0 ? (
                    <span className="text-emerald-600">
                      Sobrante de +Bs {(parseFloat(actualCash) - summary?.expectedCash).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-rose-600">
                      Faltante de -Bs {Math.abs(parseFloat(actualCash) - summary?.expectedCash).toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="label">Observaciones de Cierre (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Notas adicionales o justificación de descuadre..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCloseModal(false)} className="btn-secondary text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={mutClose.isPending} className="btn-primary bg-amber-600 text-xs">
                  {mutClose.isPending ? 'Cerrando...' : 'Confirmar Cierre de Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
