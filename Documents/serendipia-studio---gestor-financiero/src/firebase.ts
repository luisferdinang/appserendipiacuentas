import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  deleteDoc,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';

// Definir tipos para las transacciones
export interface Transaction extends DocumentData {
  id: string;
  type: 'income' | 'expense' | 'adjustment';
  description: string;
  amount: number;
  quantity: number;
  paymentMethod: 'PAGO_MOVIL_BS' | 'EFECTIVO_BS' | 'EFECTIVO_USD' | 'USDT';
  date: string;
  createdAt?: string;
}

// Definir tipo para la configuración
export interface AppSettings {
  exchangeRate: number;
  updatedAt?: string;
}

// Importar configuración de Firebase
import { firebaseConfig } from './firebase.config';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referencias a colecciones
const TRANSACTIONS_COLLECTION = 'transactions';
const SETTINGS_DOC = 'settings';

export const saveTransaction = async (transaction: any) => {
  try {
    await setDoc(doc(db, TRANSACTIONS_COLLECTION, transaction.id), transaction);
    return true;
  } catch (error) {
    console.error('Error al guardar transacción:', error);
    return false;
  }
};

export const deleteTransaction = async (id: string) => {
  try {
    await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, id));
    return true;
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    return false;
  }
};

export const getTransactions = async (): Promise<Transaction[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, TRANSACTIONS_COLLECTION));
    return querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    } as Transaction));
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    return [];
  }
};

export const subscribeToTransactions = (callback: (transactions: Transaction[]) => void) => {
  return onSnapshot(collection(db, TRANSACTIONS_COLLECTION), (snapshot) => {
    const transactions = snapshot.docs.map((doc): Transaction => ({
      id: doc.id,
      ...doc.data()
    } as Transaction));
    callback(transactions);
  });
};

export const saveSettings = async (settings: Omit<AppSettings, 'updatedAt'>) => {
  try {
    await setDoc(doc(db, SETTINGS_DOC, 'current'), {
      exchangeRate: settings.exchangeRate,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    return false;
  }
};

export const getSettings = async (): Promise<AppSettings | null> => {
  try {
    const docRef = doc(db, SETTINGS_DOC, 'current');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    // Asegurarse de que los datos tengan la estructura correcta
    if (typeof data?.exchangeRate === 'number') {
      return {
        exchangeRate: data.exchangeRate,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }
    return null;
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return null;
  }
};

export const subscribeToSettings = (callback: (settings: AppSettings | null) => void) => {
  return onSnapshot(doc(db, SETTINGS_DOC, 'current'), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      if (typeof data?.exchangeRate === 'number') {
        callback({
          exchangeRate: data.exchangeRate,
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};
