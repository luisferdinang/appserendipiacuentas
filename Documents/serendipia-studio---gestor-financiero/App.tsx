import React, { useState, useEffect, useMemo } from 'react';
import { 
  saveTransaction, 
  deleteTransaction, 
  subscribeToTransactions, 
  saveSettings, 
  subscribeToSettings,
  Transaction as FirebaseTransaction
} from './src/firebase';

// Usar la interfaz Transaction de firebase.ts
type Transaction = FirebaseTransaction;

type Currency = 'BSF' | 'USD';

// Estructura de los datos guardados/cargados
interface AppData {
  transactions: Transaction[];
  exchangeRateBSFtoUSD: number;
}


// Props para componentes
interface TransactionFormProps {
  onSubmit: (transactionData: Omit<Transaction, 'id'>, id?: string) => void;
  onClose: () => void;
  paymentMethodOptions: Record<string, string>;
  initialDate: string;
  editingTransaction: Transaction | null;
  formPurpose?: 'transaction' | 'adjustment'; // Nueva prop
}

interface FilterControlsProps {
  filterDateOption: string;
  onFilterDateOptionChange: (value: string) => void;
  customStartDate: string;
  onCustomStartDateChange: (value: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (value: string) => void;
}

/**
 * Propiedades para el componente de resumen financiero
 */
interface FinancialSummaryDisplayProps {
  /** Saldo en efectivo en Bolívares */
  balanceEfectivoBSF: number;
  /** Saldo en Pago Móvil en Bolívares */
  balancePagoMovilBSF: number;
  /** Saldo total en Bolívares (efectivo + pago móvil) */
  totalBalanceBSF: number;
  /** Saldo en efectivo en Dólares */
  balanceEfectivoUSD: number;
  /** Saldo en USDT (criptomoneda) */
  balanceUsdtUSD: number;
  /** Saldo total en Dólares (efectivo + USDT) */
  totalBalanceUSD: number;
  /** Función para formatear valores monetarios */
  formatCurrency: (value: number) => string;
}

/**
 * Propiedades para el componente de lista de transacciones
 */
interface TransactionListDisplayProps {
  /** Título de la sección */
  title: string;
  /** Lista de transacciones a mostrar */
  transactions: Transaction[];
  /** Función para formatear valores monetarios */
  formatCurrency: (value: number) => string;
  /** Función para obtener la etiqueta de un método de pago */
  getPaymentMethodLabel: (methodKey: keyof typeof paymentMethodOptions) => string;
  /** Mensaje a mostrar cuando no hay transacciones */
  emptyListMessage: string;
  /** Ícono a mostrar junto al título */
  icon: React.ReactNode;
  /** Manejador para editar una transacción */
  onEdit: (transaction: Transaction) => void;
  /** Manejador para eliminar una transacción */
  onDelete: (transactionId: string) => void; 
}

/**
 * Propiedades para el componente de modal
 */
interface ModalProps {
  /** Indica si el modal está abierto */
  isOpen: boolean;
  /** Función para cerrar el modal */
  onClose: () => void;
  /** Título del modal */
  title: string;
  /** Contenido del modal */
  children: React.ReactNode;
}

/**
 * Propiedades para el conversor de Bs. a USD
 */
interface BsToUsdConverterProps {
  /** Saldo total en Bolívares a convertir */
  currentTotalBalanceBSF: number; 
  currentExchangeRate: number;
  onSetExchangeRate: (newRate: number) => void;
  formatCurrency: (value: number) => string;
}

// Opciones de métodos de pago para el select
export const paymentMethodOptions = {
  PAGO_MOVIL_BS: 'Pago Móvil (Bs.)',
  EFECTIVO_BS: 'Efectivo (Bs.)',
  EFECTIVO_USD: 'Efectivo (USD)',
  USDT: 'USDT (Digital)',
};

// Helper para determinar la moneda de la transacción (general BSF/USD)
export const getCurrencyFromPaymentMethod = (paymentMethod: Transaction['paymentMethod']): Currency => {
  if (paymentMethod === 'PAGO_MOVIL_BS' || paymentMethod === 'EFECTIVO_BS') {
    return 'BSF';
  }
  return 'USD'; // EFECTIVO_USD y USDT
};


// Helper para normalizar date string a Date object al inicio del día UTC
const normalizeDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Asegurarse de que la fecha sea válida
  if (isNaN(date.getTime())) {
    console.warn(`Fecha inválida: ${dateStr}, usando fecha actual`);
    return new Date();
  }
  return date;
};

// Helper para formatear Date a YYYY-MM-DD string
const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper para formatear moneda (formato numérico)
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Helper para obtener etiqueta de método de pago
export const getPaymentMethodLabel = (methodKey: keyof typeof paymentMethodOptions): string => {
  return paymentMethodOptions[methodKey] || methodKey;
};

// --- Sub-componentes ---

const ShootingStarIcon: React.FC = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className="h-8 w-8 md:h-10 md:w-10 inline-block ml-2 text-yellow-400" // Adjusted size and color
    viewBox="0 0 24 24" 
    fill="none" 
    aria-hidden="true"
  >
    <path d="M12.4665 20.5953C12.3854 20.8388 12.1074 20.9702 11.8639 20.8891C11.6204 20.808 11.4889 20.53 11.5699 20.2865L12.4665 20.5953ZM13.8407 14.5369L14.289 14.7457L13.8407 14.5369ZM5.04369 10.0503L4.59544 9.8415L5.04369 10.0503ZM9.53027 3.25333C9.61138 3.00982 9.47986 2.73183 9.23635 2.65072C8.99284 2.56961 8.71485 2.70112 8.63374 2.94463L9.53027 3.25333ZM11.5699 20.2865L13.3924 14.328L14.289 14.7457L12.4665 20.5953L11.5699 20.2865ZM13.3924 14.328C13.6823 13.3287 13.3983 12.2383 12.6567 11.458L11.9039 12.0674C12.4279 12.6017 12.6017 13.3721 12.4087 13.9801L13.3924 14.328ZM12.6567 11.458C11.3789 10.0913 9.37877 9.54013 7.64333 9.47169L7.57199 10.4682C9.02123 10.5283 10.7077 10.9799 11.9039 12.0674L12.6567 11.458ZM7.64333 9.47169C5.9079 9.40324 4.01594 8.79054 2.70956 7.55747L1.99535 8.20436C3.48606 9.61093 5.6788 10.3013 7.57199 10.4682L7.64333 9.47169ZM2.70956 7.55747C1.40318 6.3244 0.963914 4.54256 1.15926 2.92837L0.165208 2.8093C-0.0717201 4.79564 0.479861 6.87556 1.99535 8.20436L2.70956 7.55747ZM5.49195 10.2591L9.53027 3.25333L8.63374 2.94463L4.59544 9.8415L5.49195 10.2591Z" 
      fill="currentColor"/>
    <path d="M18.8333 11.8333C18.8333 13.4303 18.0041 14.9213 16.6667 15.8117M16.6667 15.8117C15.3292 16.702 13.6708 16.8983 12.1832 16.3433L12.1832 16.3433C10.6957 15.7883 9.50839 14.5422 8.94191 13.0441L8.94191 13.0441C8.37543 11.5459 8.50847 9.89739 9.30833 8.52041M16.6667 15.8117L22 17.5M9.30833 8.52041L5.5 5.5M9.30833 8.52041C10.1082 7.14343 11.4303 6.16667 13 6.16667C14.5697 6.16667 15.8918 7.14343 16.6917 8.52041M16.6917 8.52041C17.4915 9.89739 17.6246 11.5459 17.0581 13.0441L17.0581 13.0441C16.4916 14.5422 15.3043 15.7883 13.8168 16.3433L13.8168 16.3433C13.0763 16.6214 12.2858 16.7571 11.5 16.7525M16.6917 8.52041L20.5 5.5" 
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} 
    >
      <div 
        className="bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-lg relative text-white transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-center flex-grow">{title}</h2>
            <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Cerrar modal"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes modalShow {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-modalShow {
          animation: modalShow 0.3s forwards;
        }
      `}</style>
    </div>
  );
};


const TransactionForm: React.FC<TransactionFormProps> = ({ 
    onSubmit, 
    onClose, 
    paymentMethodOptions: localPaymentMethodOptions, 
    initialDate, 
    editingTransaction,
    formPurpose = 'transaction' // Default to 'transaction'
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [date, setDate] = useState(initialDate);
  const [typeState, setTypeState] = useState<'income' | 'expense' | 'adjustment'>('income'); // Internal state for type select
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<keyof typeof paymentMethodOptions>('PAGO_MOVIL_BS');

  useEffect(() => {
    if (editingTransaction) {
      setDescription(editingTransaction.description);
      setAmount(String(editingTransaction.amount));
      setQuantity(String(editingTransaction.quantity));
      setDate(editingTransaction.date);
      // If editing an adjustment, set typeState to 'adjustment', otherwise use transaction's type
      setTypeState(formPurpose === 'adjustment' && editingTransaction.type === 'adjustment' ? 'adjustment' : editingTransaction.type);
      setSelectedPaymentMethod(editingTransaction.paymentMethod);
    } else {
      // For new entries
      setDescription(formPurpose === 'adjustment' ? 'Ajuste de saldo: ' : '');
      setAmount('');
      setQuantity('1');
      setDate(initialDate); 
      setTypeState(formPurpose === 'adjustment' ? 'adjustment' : 'income');
      setSelectedPaymentMethod('PAGO_MOVIL_BS');
    }
  }, [editingTransaction, initialDate, formPurpose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date) {
      alert('Por favor, completa descripción, monto y fecha.');
      return;
    }
    const finalQuantity = formPurpose === 'adjustment' ? 1 : (parseInt(quantity, 10) || 1);
    const finalAmount = parseFloat(amount);

    if (isNaN(finalAmount)) {
        alert('El monto debe ser un número válido.');
        return;
    }

    if (formPurpose === 'adjustment' && finalAmount <= 0) {
        alert('Para ajustes, el monto debe ser un número positivo para agregar al saldo.');
        return;
    }
    
    // For expenses, amount should typically be positive in the form, logic handles it as expense
    // For adjustments, it's always positive (adds to balance)
    // For income, it's positive
    // For expenses, we store a positive amount and the type 'expense' denotes subtraction
    const actualAmount = (typeState === 'expense' && formPurpose !== 'adjustment') ? Math.abs(finalAmount) : finalAmount;


    onSubmit({
      type: formPurpose === 'adjustment' ? 'adjustment' : typeState,
      description,
      amount: actualAmount,
      quantity: finalQuantity,
      paymentMethod: selectedPaymentMethod,
      date,
    }, editingTransaction ? editingTransaction.id : undefined);
  };
  
  const formId = editingTransaction ? `edit-form-${editingTransaction.id}` : (formPurpose === 'adjustment' ? "add-adjustment-form" : "add-transaction-form");
  const isAdjustmentMode = formPurpose === 'adjustment';

  return (
    <section id={formId} className="bg-transparent p-0 md:p-0">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-sky-100 mb-1">Descripción</label>
          <input
            type="text" id={`${formId}-description`} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={isAdjustmentMode ? "Ej: Saldo inicial Efectivo USD" : "Ej: Venta de 100 tarjetas"}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors" required
          />
        </div>
        <div className={`grid grid-cols-1 ${isAdjustmentMode ? '' : 'md:grid-cols-2'} gap-6`}>
          <div>
            <label htmlFor={`${formId}-amount`} className="block text-sm font-medium text-sky-100 mb-1">
              {isAdjustmentMode ? "Monto del Ajuste (Positivo)" : "Monto Total"}
            </label>
            <input
              type="number" id={`${formId}-amount`} value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 150.00" step="0.01" 
              min={ (formPurpose === 'adjustment' || typeState === 'income') ? "0.01" : undefined } // Positive for adjustments/income
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors" required
            />
          </div>
          {!isAdjustmentMode && (
            <div>
              <label htmlFor={`${formId}-quantity`} className="block text-sm font-medium text-sky-100 mb-1">Cantidad</label>
              <input
                type="number" id={`${formId}-quantity`} value={quantity} onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ej: 1" step="1" min="1"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors" required
              />
            </div>
          )}
        </div>
        <div className={`grid grid-cols-1 ${isAdjustmentMode ? '' : 'md:grid-cols-2'} gap-6`}>
          <div>
            <label htmlFor={`${formId}-date`} className="block text-sm font-medium text-sky-100 mb-1">
              {isAdjustmentMode ? "Fecha del Ajuste" : "Fecha"}
            </label>
            <input
              type="date" id={`${formId}-date`} value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors" required
            />
          </div>
          {!isAdjustmentMode && (
            <div>
              <label htmlFor={`${formId}-type`} className="block text-sm font-medium text-sky-100 mb-1">Tipo</label>
              <select
                id={`${formId}-type`} 
                value={typeState === 'adjustment' ? 'income' : typeState} // Can't select 'adjustment'
                onChange={(e) => setTypeState(e.target.value as 'income' | 'expense')}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors"
              >
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <label htmlFor={`${formId}-paymentMethod`} className="block text-sm font-medium text-sky-100 mb-1">
            {isAdjustmentMode ? "Cuenta a Ajustar" : "Método de Pago (Indica la moneda)"}
          </label>
          <select
            id={`${formId}-paymentMethod`} value={selectedPaymentMethod} onChange={(e) => setSelectedPaymentMethod(e.target.value as keyof typeof paymentMethodOptions)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors"
          >
            {Object.entries(localPaymentMethodOptions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex space-x-4 pt-2">
            <button type="button" onClick={onClose} className="w-1/2 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-75">
                Cancelar
            </button>
            <button type="submit" className={`w-1/2 font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
                editingTransaction 
                ? (isAdjustmentMode ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400' : 'bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400')
                : (isAdjustmentMode ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400' : 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-400')
            }`}>
            {editingTransaction ? (isAdjustmentMode ? 'Actualizar Ajuste' : 'Actualizar Transacción') : (isAdjustmentMode ? 'Agregar Ajuste' : 'Agregar Transacción')}
            </button>
        </div>
      </form>
    </section>
  );
};

const FilterControls: React.FC<FilterControlsProps> = ({
  filterDateOption, onFilterDateOptionChange,
  customStartDate, onCustomStartDateChange,
  customEndDate, onCustomEndDateChange
}) => {
  return (
    <section className="bg-white/10 backdrop-blur-md shadow-xl rounded-xl p-6 md:p-8">
      <h2 className="text-xl font-semibold mb-4 text-center text-sky-100">Filtrar Transacciones</h2>
      <div className={`grid grid-cols-1 ${filterDateOption === 'custom' ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4 items-end`}>
        <div className={`${filterDateOption === 'custom' ? 'md:col-span-1' : 'md:col-span-1'}`}>
          <label htmlFor="filterDateOption" className="block text-sm font-medium text-sky-200 mb-1">Por Fecha:</label>
          <select
            id="filterDateOption"
            value={filterDateOption}
            onChange={(e) => {
              onFilterDateOptionChange(e.target.value);
              if (e.target.value !== 'custom') {
                onCustomStartDateChange('');
                onCustomEndDateChange('');
              } else {
                const todayStr = new Date().toISOString().split('T')[0];
                onCustomStartDateChange(todayStr);
                onCustomEndDateChange(todayStr);
              }
            }}
            className="w-full bg-slate-700/60 border border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors text-white"
            style={{ colorScheme: 'dark' }}
          >
            <option value="all">Todas las fechas</option>
            <option value="today">Hoy</option>
            <option value="thisWeek">Esta Semana</option>
            <option value="thisMonth">Este Mes</option>
            <option value="custom">Rango Personalizado</option>
          </select>
        </div>
        {filterDateOption === 'custom' && (
          <>
            <div>
              <label htmlFor="customStartDate" className="block text-sm font-medium text-sky-200 mb-1">Desde:</label>
              <input
                type="date"
                id="customStartDate"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                className="w-full bg-slate-700/60 border border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors text-white"
                max={customEndDate || undefined}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label htmlFor="customEndDate" className="block text-sm font-medium text-sky-200 mb-1">Hasta:</label>
              <input
                type="date"
                id="customEndDate"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                className="w-full bg-slate-700/60 border border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors text-white"
                min={customStartDate || undefined}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const FinancialSummaryDisplay: React.FC<FinancialSummaryDisplayProps> = ({ 
  balanceEfectivoBSF, balancePagoMovilBSF, totalBalanceBSF,
  balanceEfectivoUSD, balanceUsdtUSD, totalBalanceUSD,
  formatCurrency 
}) => {
  return (
    <section className="bg-white/10 backdrop-blur-md shadow-2xl rounded-xl p-6 md:p-8">
      <h2 className="text-2xl font-semibold mb-6 text-center">Resumen Financiero Detallado</h2>
      
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 text-sky-200 text-center border-b border-sky-200/30 pb-2">Bolívares (Bs.)</h3>
        <div className="space-y-3">
          <div className="bg-slate-700/40 p-3 rounded-lg flex justify-between items-center">
            <p className="text-sm text-sky-100">Saldo Efectivo:</p>
            <p className={`text-lg font-semibold ${balanceEfectivoBSF >= 0 ? 'text-sky-300' : 'text-orange-400'}`}>Bs. {formatCurrency(balanceEfectivoBSF)}</p>
          </div>
          <div className="bg-slate-700/40 p-3 rounded-lg flex justify-between items-center">
            <p className="text-sm text-sky-100">Saldo Banco (Pago Móvil):</p>
            <p className={`text-lg font-semibold ${balancePagoMovilBSF >= 0 ? 'text-sky-300' : 'text-orange-400'}`}>Bs. {formatCurrency(balancePagoMovilBSF)}</p>
          </div>
          <div className="bg-sky-600/30 p-4 rounded-lg flex justify-between items-center mt-2 border-t-2 border-sky-500">
            <p className="text-md font-bold text-sky-100">Saldo Total Bs.:</p>
            <p className={`text-xl font-bold ${totalBalanceBSF >= 0 ? 'text-white' : 'text-orange-300'}`}>Bs. {formatCurrency(totalBalanceBSF)}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-pink-200 text-center border-b border-pink-200/30 pb-2">Dólares (USD)</h3>
        <div className="space-y-3">
          <div className="bg-slate-700/40 p-3 rounded-lg flex justify-between items-center">
            <p className="text-sm text-pink-100">Saldo Efectivo:</p>
            <p className={`text-lg font-semibold ${balanceEfectivoUSD >= 0 ? 'text-pink-300' : 'text-orange-400'}`}>$ {formatCurrency(balanceEfectivoUSD)}</p>
          </div>
          <div className="bg-slate-700/40 p-3 rounded-lg flex justify-between items-center">
            <p className="text-sm text-pink-100">Saldo Digital (USDT):</p>
            <p className={`text-lg font-semibold ${balanceUsdtUSD >= 0 ? 'text-pink-300' : 'text-orange-400'}`}>$ {formatCurrency(balanceUsdtUSD)}</p>
          </div>
          <div className="bg-pink-600/30 p-4 rounded-lg flex justify-between items-center mt-2 border-t-2 border-pink-500">
            <p className="text-md font-bold text-pink-100">Saldo Total USD:</p>
            <p className={`text-xl font-bold ${totalBalanceUSD >= 0 ? 'text-white' : 'text-orange-300'}`}>$ {formatCurrency(totalBalanceUSD)}</p>
          </div>
        </div>
      </div>
       <p className="text-xs text-slate-400 mt-6 text-center">
        Nota: El resumen refleja los saldos por tipo de cuenta según el filtro de fecha aplicado.
      </p>
    </section>
  );
};

const TransactionListDisplay: React.FC<TransactionListDisplayProps> = ({ title, transactions, formatCurrency, getPaymentMethodLabel, emptyListMessage, icon, onEdit, onDelete }) => {

  return (
    <section className="bg-white/10 backdrop-blur-md shadow-2xl rounded-xl p-6 md:p-8">
      <h2 className="text-2xl font-semibold mb-6 flex items-center justify-center">
        {icon}
        {title} ({transactions.length})
      </h2>
      {transactions.length === 0 ? (
        <p className="text-slate-400 text-center py-4">{emptyListMessage}</p>
      ) : (
        <ul className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {transactions.map(t => (
            <li key={t.id} className="bg-slate-700/50 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sky-200">
                    {t.type === 'adjustment' && <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full mr-1.5">AJUSTE</span>}
                    {t.description} 
                    {t.type !== 'adjustment' && ` (x${t.quantity})`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(t.date + 'T00:00:00Z').toLocaleDateString('es-VE', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })} - {getPaymentMethodLabel(t.paymentMethod as keyof typeof paymentMethodOptions)}
                  </p>
                </div>
                <p className={`text-lg font-bold ${t.type === 'expense' ? 'text-red-400' : 'text-green-400'} whitespace-nowrap`}>
                  {t.type === 'expense' ? '-' : '+'}{getCurrencyFromPaymentMethod(t.paymentMethod) === 'BSF' ? 'Bs. ' : '$ '}{formatCurrency(t.amount)}
                </p>
              </div>
              <div className="mt-3 flex justify-end space-x-3">
                <button
                  onClick={() => onEdit(t)}
                  className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white py-1.5 px-3 rounded-md transition-colors flex items-center shadow hover:shadow-md"
                  aria-label={`Editar ${t.description}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                  </svg>
                  Editar
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded-md transition-colors flex items-center shadow hover:shadow-md"
                  aria-label={`Eliminar ${t.description}`}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const BsToUsdConverter: React.FC<BsToUsdConverterProps> = ({ 
  currentTotalBalanceBSF, 
  currentExchangeRate, 
  onSetExchangeRate,
  formatCurrency
}) => {
  const [inputRate, setInputRate] = useState(String(currentExchangeRate || ''));

  useEffect(() => {
    setInputRate(String(currentExchangeRate || ''));
  }, [currentExchangeRate]);

  const handleRateUpdate = () => {
    const newRate = parseFloat(inputRate);
    if (!isNaN(newRate) && newRate > 0) {
      onSetExchangeRate(newRate);
    } else {
      alert('Por favor, ingresa una tasa de cambio válida y positiva.');
      setInputRate(String(currentExchangeRate || '')); // Reset to current valid rate
    }
  };

  const equivalentUSD = currentExchangeRate > 0 ? currentTotalBalanceBSF / currentExchangeRate : 0;

  return (
    <section className="bg-white/10 backdrop-blur-md shadow-2xl rounded-xl p-6 md:p-8 mt-8">
      <h2 className="text-xl font-semibold mb-4 text-center text-sky-100">Conversor Bs. a USD (Referencial)</h2>
      <div className="space-y-4">
        <div className="bg-slate-700/40 p-3 rounded-lg">
          <p className="text-sm text-sky-100">Saldo Total Actual en Bolívares:</p>
          <p className="text-lg font-semibold text-sky-300">Bs. {formatCurrency(currentTotalBalanceBSF)}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex-grow w-full sm:w-auto">
            <label htmlFor="exchangeRateInput" className="block text-sm font-medium text-sky-200 mb-1">Tasa del día (Bs. por 1 USD):</label>
            <input
              type="number"
              id="exchangeRateInput"
              value={inputRate}
              onChange={(e) => setInputRate(e.target.value)}
              placeholder="Ej: 36.50"
              step="0.01"
              min="0.01"
              className="w-full bg-slate-700/60 border border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors text-white"
            />
          </div>
          <button
            onClick={handleRateUpdate}
            className="w-full sm:w-auto bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2.5 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-opacity-75"
          >
            Actualizar Tasa
          </button>
        </div>
        <div className="bg-pink-600/30 p-4 rounded-lg mt-2 border-t-2 border-pink-500">
          <p className="text-sm text-pink-100">Equivalente Estimado en Dólares:</p>
          <p className="text-xl font-bold text-white">$ {formatCurrency(equivalentUSD)}</p>
        </div>
      </div>
    </section>
  );
};

const App: React.FC = () => {
  // Estado inicial
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exchangeRateBSFtoUSD, setExchangeRateBSFtoUSD] = useState<number>(0);
  // Estado para manejar carga inicial
  const [, setIsLoading] = useState<boolean>(true);

  // Cargar datos de Firebase al iniciar
  useEffect(() => {
    // Suscribirse a cambios en las transacciones
    const unsubscribeTransactions = subscribeToTransactions((firebaseTransactions) => {
      setTransactions(firebaseTransactions as Transaction[]);
      setIsLoading(false);
    });

    // Suscribirse a cambios en la configuración
    const unsubscribeSettings = subscribeToSettings((settings) => {
      if (settings?.exchangeRate) {
        setExchangeRateBSFtoUSD(settings.exchangeRate);
      }
    });

    // Limpiar suscripciones al desmontar
    return () => {
      unsubscribeTransactions();
      unsubscribeSettings();
    };
  }, []);

  const [filterDateOption, setFilterDateOption] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [showAddFormModal, setShowAddFormModal] = useState(false);
  const [showAddAdjustmentModal, setShowAddAdjustmentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [transactionIdToDelete, setTransactionIdToDelete] = useState<string | null>(null);

  const todayDateString = useMemo(() => formatDateToYYYYMMDD(new Date()), []);

  // Filtrado de transacciones
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterDateOption === 'all') return true;
      const transactionDate = normalizeDate(t.date);
      if (filterDateOption === 'today') {
        return transactionDate.getTime() === normalizeDate(todayDateString).getTime();
      }
      if (filterDateOption === 'thisWeek') {
        const today = normalizeDate(todayDateString);
        const dayOfWeek = today.getUTCDay(); // 0 (Sun) - 6 (Sat)
        const startOfWeek = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) )); // Adjust for Sunday
        const endOfWeek = new Date(Date.UTC(startOfWeek.getUTCFullYear(), startOfWeek.getUTCMonth(), startOfWeek.getUTCDate() + 6));
        return transactionDate >= startOfWeek && transactionDate <= endOfWeek;
      }
      if (filterDateOption === 'thisMonth') {
        const today = normalizeDate(todayDateString);
        const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
        return transactionDate >= startOfMonth && transactionDate <= endOfMonth;
      }
      if (filterDateOption === 'custom' && customStartDate && customEndDate) {
        const startDate = normalizeDate(customStartDate);
        const endDate = normalizeDate(customEndDate);
        return transactionDate >= startDate && transactionDate <= endDate;
      }
      return true;
    }).sort((a, b) => normalizeDate(b.date).getTime() - normalizeDate(a.date).getTime() || b.id.localeCompare(a.id));
  }, [transactions, filterDateOption, customStartDate, customEndDate, todayDateString]);

  const filteredIncomeTransactions = useMemo(() => 
    filteredTransactions.filter(t => t.type === 'income' || t.type === 'adjustment'), 
  [filteredTransactions]);

  const filteredExpenseTransactions = useMemo(() => 
    filteredTransactions.filter(t => t.type === 'expense'),
  [filteredTransactions]);
  
  // Cálculo de totales financieros detallados
  const detailedFinancialTotals = useMemo(() => {
    const totals = {
      incomeEfectivoBSF: 0, expensesEfectivoBSF: 0,
      incomePagoMovilBSF: 0, expensesPagoMovilBSF: 0,
      incomeEfectivoUSD: 0, expensesEfectivoUSD: 0,
      incomeUsdtUSD: 0, expensesUsdtUSD: 0,
    };

    for (const t of filteredTransactions) {
      const amount = t.amount;
      const isIncomeOrAdjustment = t.type === 'income' || t.type === 'adjustment';

      if (t.paymentMethod === 'EFECTIVO_BS') {
        if (isIncomeOrAdjustment) totals.incomeEfectivoBSF += amount;
        else if (t.type === 'expense') totals.expensesEfectivoBSF += amount;
      } else if (t.paymentMethod === 'PAGO_MOVIL_BS') {
        if (isIncomeOrAdjustment) totals.incomePagoMovilBSF += amount;
        else if (t.type === 'expense') totals.expensesPagoMovilBSF += amount;
      } else if (t.paymentMethod === 'EFECTIVO_USD') {
        if (isIncomeOrAdjustment) totals.incomeEfectivoUSD += amount;
        else if (t.type === 'expense') totals.expensesEfectivoUSD += amount;
      } else if (t.paymentMethod === 'USDT') {
        if (isIncomeOrAdjustment) totals.incomeUsdtUSD += amount;
        else if (t.type === 'expense') totals.expensesUsdtUSD += amount;
      }
    }
    
    const balanceEfectivoBSF = totals.incomeEfectivoBSF - totals.expensesEfectivoBSF;
    const balancePagoMovilBSF = totals.incomePagoMovilBSF - totals.expensesPagoMovilBSF;
    const totalBalanceBSF = balanceEfectivoBSF + balancePagoMovilBSF;

    const balanceEfectivoUSD = totals.incomeEfectivoUSD - totals.expensesEfectivoUSD;
    const balanceUsdtUSD = totals.incomeUsdtUSD - totals.expensesUsdtUSD;
    const totalBalanceUSD = balanceEfectivoUSD + balanceUsdtUSD;

    return { 
      balanceEfectivoBSF, balancePagoMovilBSF, totalBalanceBSF,
      balanceEfectivoUSD, balanceUsdtUSD, totalBalanceUSD
    };
  }, [filteredTransactions]);


  // Manejadores de Modales y Formularios
  const handleOpenAddFormModal = () => setShowAddFormModal(true);
  const handleCloseAddFormModal = () => setShowAddFormModal(false);
  
  const handleOpenAddAdjustmentModal = () => setShowAddAdjustmentModal(true);
  const handleCloseAddAdjustmentModal = () => setShowAddAdjustmentModal(false);

  const handleOpenEditModal = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setShowEditModal(true);
  };
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setTransactionToEdit(null);
  };

  const handleRequestDelete = (transactionId: string) => {
    setTransactionIdToDelete(transactionId);
    setIsDeleteConfirmModalOpen(true);
  };

  const executeDeleteTransaction = async () => {
    if (transactionIdToDelete) {
      try {
        await deleteTransaction(transactionIdToDelete);
        setTransactions(prev => prev.filter(t => t.id !== transactionIdToDelete));
        setTransactionIdToDelete(null);
        setIsDeleteConfirmModalOpen(false);
        alert('Transacción eliminada con éxito.');
      } catch (error) {
        console.error('Error al eliminar transacción:', error);
        alert('Error al eliminar la transacción. Por favor, inténtalo de nuevo.');
      }
    }
  };

  const cancelDeleteTransaction = () => {
    setTransactionIdToDelete(null);
    setIsDeleteConfirmModalOpen(false);
  };

  // Función auxiliar para guardar múltiples transacciones (se deja comentada para uso futuro)
  /*
  const saveDataToFirebase = useCallback(async (newTransactions: Transaction[], newExchangeRate: number) => {
    try {
      // Actualizar transacciones
      await Promise.all(newTransactions.map(tx => saveTransaction(tx)));
      
      // Actualizar configuración
      await saveSettings({ exchangeRate: newExchangeRate });
      return true;
    } catch (error) {
      console.error('Error al guardar en Firebase:', error);
      alert('Error al guardar los datos. Por favor, inténtalo de nuevo.');
      return false;
    }
  }, []);
  */

  // Función para limpiar todos los datos
  const handleClearAllData = async () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar todos los datos? Esta acción no se puede deshacer.')) {
      try {
        // Eliminar todas las transacciones
        const deletePromises = transactions.map(tx => deleteTransaction(tx.id));
        await Promise.all(deletePromises);
        
        // Restablecer la tasa de cambio
        await saveSettings({ exchangeRate: 0 });
        
        // Limpiar estado local
        setTransactions([]);
        setExchangeRateBSFtoUSD(0);
        
        alert('Todos los datos han sido eliminados.');
      } catch (error) {
        console.error('Error al eliminar datos:', error);
        alert('Ocurrió un error al intentar eliminar los datos.');
      }
    }
  };

  const handleFormSubmit = async (transactionData: Omit<Transaction, 'id' | 'createdAt'>, id?: string) => {
    try {
      // Validar los datos de la transacción
      if (!transactionData || 
          !['income', 'expense', 'adjustment'].includes(transactionData.type) ||
          typeof transactionData.amount !== 'number' || 
          transactionData.amount <= 0 ||
          !transactionData.date || 
          isNaN(new Date(transactionData.date).getTime()) ||
          !transactionData.description ||
          !transactionData.paymentMethod) {
        throw new Error('Datos de transacción inválidos o incompletos');
      }

      // Crear objeto de transacción base
      const baseTransaction = {
        type: transactionData.type as 'income' | 'expense' | 'adjustment',
        description: transactionData.description,
        amount: transactionData.amount,
        quantity: transactionData.quantity || 1,
        paymentMethod: transactionData.paymentMethod as 'PAGO_MOVIL_BS' | 'EFECTIVO_BS' | 'EFECTIVO_USD' | 'USDT',
        date: formatDateToYYYYMMDD(new Date(transactionData.date))
      };

      if (id) { // Actualizar
        const updatedTransaction: Transaction = { 
          ...baseTransaction,
          id,
          createdAt: transactions.find(t => t.id === id)?.createdAt || new Date().toISOString()
        };
        
        await saveTransaction(updatedTransaction);
        // No es necesario actualizar el estado local aquí, la suscripción a Firestore se encargará de ello
        alert('Transacción actualizada con éxito.');
      } else { // Crear
        const newTransaction: Transaction = { 
          ...baseTransaction,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        };
        
        await saveTransaction(newTransaction);
        // No es necesario actualizar el estado local aquí, la suscripción a Firestore se encargará de ello
        
        if (transactionData.type === 'adjustment') {
          alert('Ajuste agregado con éxito.');
        } else {
          alert('Transacción agregada con éxito.');
        }
      }
    } catch (error) {
      console.error('Error al procesar la transacción:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      handleCloseAddFormModal();
      handleCloseEditModal();
      handleCloseAddAdjustmentModal();
    }
  };
  
  const handleSetExchangeRate = async (newRate: number) => {
    try {
      await saveSettings({ exchangeRate: newRate });
      setExchangeRateBSFtoUSD(newRate);
      alert('Tasa de cambio actualizada con éxito.');
    } catch (error) {
      console.error('Error al actualizar la tasa de cambio:', error);
      alert('Error al actualizar la tasa de cambio. Por favor, inténtalo de nuevo.');
    }
  };

  // Guardar datos en archivo JSON
  const handleSaveData = () => {
    const appData: AppData = {
      transactions,
      exchangeRateBSFtoUSD,
    };
    const jsonData = JSON.stringify(appData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gestor_financiero_datos.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Datos guardados en "gestor_financiero_datos.json".');
  };

  // Cargar datos desde archivo JSON
  const handleLoadData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsedData: AppData = JSON.parse(text);
          // Validaciones básicas de la estructura
          if (Array.isArray(parsedData.transactions) && typeof parsedData.exchangeRateBSFtoUSD === 'number') {
            // Validación más profunda de cada transacción (opcional pero recomendado)
            const isValidTransactions = parsedData.transactions.every(t => {
              try {
                if (typeof t.id !== 'string') return false;
                if (!['income', 'expense', 'adjustment'].includes(t.type)) return false;
                if (typeof t.description !== 'string') return false;
                if (typeof t.amount !== 'number' || t.amount <= 0) return false;
                if (typeof t.quantity !== 'number' || t.quantity <= 0) return false;
                if (!Object.keys(paymentMethodOptions).includes(t.paymentMethod)) return false;
                
                // Validar fecha
                const date = new Date(t.date);
                if (isNaN(date.getTime())) return false;
                
                // Normalizar la fecha al guardar
                t.date = formatDateToYYYYMMDD(date);
                
                return true;
              } catch (error) {
                console.error('Error validando transacción:', t, error);
                return false;
              }
            });

            if (isValidTransactions) {
              setTransactions(parsedData.transactions);
              setExchangeRateBSFtoUSD(parsedData.exchangeRateBSFtoUSD);
              alert('Datos cargados correctamente desde el archivo.');
            } else {
              throw new Error('El archivo contiene transacciones con formato inválido.');
            }
          } else {
            alert('Error: El archivo JSON no tiene la estructura esperada (transactions o exchangeRateBSFtoUSD faltan o tienen tipo incorrecto).');
          }
        } catch (error) {
          console.error("Error al parsear el archivo JSON:", error);
          alert(`Error al cargar el archivo: ${error instanceof Error ? error.message : 'Formato de archivo inválido'}`);
          alert('Error al leer o parsear el archivo JSON. Asegúrate de que es un archivo JSON válido exportado por esta aplicación.');
        }
      };
      reader.readAsText(file);
      event.target.value = ''; // Reset file input
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-700 via-slate-800 to-purple-900 text-white p-4 md:p-8 selection:bg-pink-500 selection:text-white">
      <header className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight flex items-center justify-center">
          Serendipia Studio
          <ShootingStarIcon />
        </h1>
        <p className="text-sky-300 mt-2 text-sm md:text-base">Tu gestor financiero para Serendipia Studio.</p>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        <section aria-labelledby="actions-title" className="bg-white/5 backdrop-blur-sm shadow-lg rounded-xl p-4 md:p-6">
            <h2 id="actions-title" className="sr-only">Acciones Principales</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <button
                    onClick={handleOpenAddFormModal}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 text-sm md:text-base"
                >
                    Nueva Transacción
                </button>
                <button
                    onClick={handleOpenAddAdjustmentModal}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 text-sm md:text-base"
                >
                    Nuevo Ajuste
                </button>
                 <button
                    onClick={handleSaveData}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 text-sm md:text-base"
                >
                    Guardar Datos
                </button>
                <div> {/* Wrapper for file input to style its button trigger */}
                    <label htmlFor="load-data-input" className="cursor-pointer w-full block text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-75 text-sm md:text-base">
                        Cargar Datos
                    </label>
                    <input
                        type="file"
                        id="load-data-input"
                        accept=".json"
                        onChange={handleLoadData}
                        className="hidden"
                    />
                </div>
            </div>
        </section>

        <FilterControls
          filterDateOption={filterDateOption}
          onFilterDateOptionChange={setFilterDateOption}
          customStartDate={customStartDate}
          onCustomStartDateChange={setCustomStartDate}
          customEndDate={customEndDate}
          onCustomEndDateChange={setCustomEndDate}
        />

        <FinancialSummaryDisplay {...detailedFinancialTotals} formatCurrency={formatCurrency} />

        <div className="grid md:grid-cols-2 gap-8">
            <TransactionListDisplay
                title="Historial de Ingresos y Ajustes"
                transactions={filteredIncomeTransactions}
                formatCurrency={formatCurrency}
                getPaymentMethodLabel={getPaymentMethodLabel}
                emptyListMessage="No hay ingresos ni ajustes registrados para el período seleccionado."
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                }
                onEdit={handleOpenEditModal}
                onDelete={handleRequestDelete}
            />
            <TransactionListDisplay
                title="Historial de Gastos"
                transactions={filteredExpenseTransactions}
                formatCurrency={formatCurrency}
                getPaymentMethodLabel={getPaymentMethodLabel}
                emptyListMessage="No hay gastos registrados para el período seleccionado."
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                }
                onEdit={handleOpenEditModal}
                onDelete={handleRequestDelete}
            />
        </div>
        
        <div className="flex gap-4">
            <BsToUsdConverter 
              currentTotalBalanceBSF={detailedFinancialTotals.totalBalanceBSF} 
              currentExchangeRate={exchangeRateBSFtoUSD}
              onSetExchangeRate={handleSetExchangeRate}
              formatCurrency={formatCurrency}
            />
            <button 
              onClick={handleClearAllData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title="Eliminar todos los datos"
            >
              Limpiar Datos
            </button>
          </div>

      </main>

      <footer className="text-center mt-12 py-6 border-t border-slate-700">
        <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Serendipia Studio. Todos los derechos reservados.</p>
      </footer>

      {/* Modales */}
      <Modal isOpen={showAddFormModal} onClose={handleCloseAddFormModal} title="Registrar Nueva Transacción">
        <TransactionForm
          onSubmit={handleFormSubmit}
          onClose={handleCloseAddFormModal}
          paymentMethodOptions={paymentMethodOptions}
          initialDate={todayDateString}
          editingTransaction={null}
          formPurpose="transaction"
        />
      </Modal>
      <Modal isOpen={showAddAdjustmentModal} onClose={handleCloseAddAdjustmentModal} title="Registrar Nuevo Ajuste">
        <TransactionForm
          onSubmit={handleFormSubmit}
          onClose={handleCloseAddAdjustmentModal}
          paymentMethodOptions={paymentMethodOptions}
          initialDate={todayDateString}
          editingTransaction={null}
          formPurpose="adjustment"
        />
      </Modal>
      <Modal isOpen={showEditModal} onClose={handleCloseEditModal} title={transactionToEdit?.type === 'adjustment' ? "Editar Ajuste" : "Editar Transacción"}>
        {transactionToEdit && (
          <TransactionForm
            onSubmit={handleFormSubmit}
            onClose={handleCloseEditModal}
            paymentMethodOptions={paymentMethodOptions}
            initialDate={todayDateString} // Not strictly needed when editing, but form expects it
            editingTransaction={transactionToEdit}
            formPurpose={transactionToEdit.type === 'adjustment' ? 'adjustment' : 'transaction'}
          />
        )}
      </Modal>
      <Modal isOpen={isDeleteConfirmModalOpen} onClose={cancelDeleteTransaction} title="Confirmar Eliminación">
        <div className="text-center">
          <p className="text-lg mb-6">¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer.</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={cancelDeleteTransaction}
              className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={executeDeleteTransaction}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Sí, Eliminar
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default App;