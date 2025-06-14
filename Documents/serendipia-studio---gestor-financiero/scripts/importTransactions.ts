import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Configura las credenciales de Firebase Admin
const serviceAccount = require('../../serviceAccountKey.json');

// Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://appcuentas-ec3b6.firebaseio.com' // URL de Firestore
});

const db = admin.firestore();

// Interfaz para los datos de transacción del archivo JSON
interface JsonTransaction {
  date: string;
  type: 'ajuste' | 'venta' | 'gasto' | 'pago' | 'ingreso' | 'retiro' | 'transferencia';
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  income: number;
  expense: number;
  payment: {
    banco: number;
    efectivo: number;
    usd: number;
    usdt: number;
  };
  id: string;
}

// Función para mapear los datos del JSON al formato de tu aplicación
function mapToFirebaseTransaction(tx: JsonTransaction): any {
  // Determinar el tipo de transacción
  let type: 'income' | 'expense' | 'adjustment' = 'adjustment';
  let amount = 0;
  let paymentMethod: 'PAGO_MOVIL_BS' | 'EFECTIVO_BS' | 'EFECTIVO_USD' | 'USDT' = 'EFECTIVO_BS';
  
  // Determinar el tipo de transacción y el monto
  if (tx.income > 0) {
    type = 'income';
    amount = tx.income;
  } else if (tx.expense > 0) {
    type = 'expense';
    amount = tx.expense;
  }
  
  // Determinar el método de pago
  if (tx.payment.banco > 0) {
    paymentMethod = 'PAGO_MOVIL_BS';
  } else if (tx.payment.efectivo > 0) {
    paymentMethod = 'EFECTIVO_BS';
  } else if (tx.payment.usd > 0) {
    paymentMethod = 'EFECTIVO_USD';
  } else if (tx.payment.usdt > 0) {
    paymentMethod = 'USDT';
  }
  
  // Crear la transacción en el formato de tu aplicación
  return {
    id: tx.id,
    type,
    description: tx.description,
    amount,
    quantity: tx.quantity || 1,
    paymentMethod,
    date: tx.date,
    createdAt: new Date().toISOString()
  };
}

// Función principal para importar transacciones
async function importTransactions() {
  try {
    // Leer el archivo JSON
    const jsonPath = path.resolve(__dirname, '../../db.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    const transactions: JsonTransaction[] = JSON.parse(jsonData);
    
    console.log(`Se encontraron ${transactions.length} transacciones para importar.`);
    
    // Procesar cada transacción
    for (const tx of transactions) {
      try {
        const firebaseTx = mapToFirebaseTransaction(tx);
        await db.collection('transactions').doc(tx.id).set(firebaseTx);
        console.log(`Transacción importada: ${tx.id} - ${tx.description}`);
      } catch (error) {
        console.error(`Error al importar transacción ${tx.id}:`, error);
      }
    }
    
    console.log('Importación completada con éxito.');
  } catch (error) {
    console.error('Error durante la importación:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar la importación
importTransactions();
