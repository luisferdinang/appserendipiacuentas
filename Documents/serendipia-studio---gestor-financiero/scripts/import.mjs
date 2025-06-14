import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar el archivo de credenciales
const serviceAccount = JSON.parse(
  await readFile(resolve(__dirname, '../serviceAccountKey.json'), 'utf-8')
);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://appcuentas-ec3b6.firebaseio.com'
});

const db = admin.firestore();

// Función para mapear los datos del JSON al formato de tu aplicación
function mapToFirebaseTransaction(tx) {
  // Determinar el tipo de transacción
  let type = tx.type === 'ajuste' ? 'adjustment' : 
             tx.type === 'venta' ? 'income' : 
             tx.type === 'gasto' ? 'expense' : tx.type;
  
  let amount = 0;
  let paymentMethod = 'EFECTIVO_BS';
  
  // Determinar el método de pago basado en qué campo tiene valor
  if (tx.payment.banco > 0) {
    paymentMethod = 'PAGO_MOVIL_BS';
    amount = tx.payment.banco;
  } else if (tx.payment.efectivo > 0) {
    paymentMethod = 'EFECTIVO_BS';
    amount = tx.payment.efectivo;
  } else if (tx.payment.usd > 0) {
    paymentMethod = 'EFECTIVO_USD';
    amount = tx.payment.usd;
  } else if (tx.payment.usdt > 0) {
    paymentMethod = 'USDT';
    amount = tx.payment.usdt;
  }
  
  // Para transacciones de venta o gasto, usar el monto de income/expense si está disponible
  if (tx.type === 'venta' && tx.income > 0) {
    amount = tx.income;
  } else if (tx.type === 'gasto' && tx.expense > 0) {
    amount = tx.expense;
  }
  
  // Para transacciones de ajuste, sumar todos los montos de pago
  if (tx.type === 'ajuste') {
    amount = Object.values(tx.payment).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }

  // Crear la transacción en el formato de tu aplicación
  const transaction = {
    id: tx.id,
    type,
    description: tx.description,
    amount: amount,
    quantity: tx.quantity || 1,
    paymentMethod,
    date: tx.date,
    createdAt: new Date().toISOString(),
    // Agregar los montos específicos de cada moneda
    paymentDetails: {
      banco: tx.payment.banco || 0,
      efectivo: tx.payment.efectivo || 0,
      usd: tx.payment.usd || 0,
      usdt: tx.payment.usdt || 0
    },
    // Mantener los campos originales para referencia
    originalData: {
      income: tx.income,
      expense: tx.expense,
      unitPrice: tx.unitPrice
    }
  };
  
  console.log(`Procesando transacción ${tx.id}:`, JSON.stringify(transaction, null, 2));
  return transaction;
}

// Función para limpiar la colección de transacciones
async function clearTransactions() {
  try {
    console.log('Eliminando transacciones existentes...');
    const snapshot = await db.collection('transactions').get();
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('Transacciones existentes eliminadas.');
    return true;
  } catch (error) {
    console.error('Error al limpiar transacciones:', error);
    return false;
  }
}

// Función principal para importar transacciones
async function importTransactions() {
  try {
    // Primero limpiar la colección existente
    const cleared = await clearTransactions();
    if (!cleared) {
      console.log('Continuando con la importación...');
    }
    
    // Leer el archivo JSON
    const jsonPath = resolve(__dirname, '../db.json');
    const jsonData = await readFile(jsonPath, 'utf-8');
    const transactions = JSON.parse(jsonData);
    
    console.log(`Se encontraron ${transactions.length} transacciones para importar.`);
    
    // Procesar cada transacción
    for (const tx of transactions) {
      try {
        const firebaseTx = mapToFirebaseTransaction(tx);
        await db.collection('transactions').doc(tx.id).set(firebaseTx);
        console.log(`✅ Transacción importada: ${tx.id} - ${tx.description}`);
      } catch (error) {
        console.error(`❌ Error al importar transacción ${tx.id}:`, error.message);
      }
    }
    
    console.log('🎉 ¡Importación completada con éxito!');
  } catch (error) {
    console.error('❌ Error durante la importación:', error.message);
  } finally {
    process.exit(0);
  }
}

// Ejecutar la importación
importTransactions();
