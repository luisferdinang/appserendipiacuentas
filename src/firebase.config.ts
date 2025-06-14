// Configuración de Firebase
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validar configuración
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);

if (missingVars.length > 0) {
  console.error('Error: Faltan las siguientes variables de entorno de Firebase:', missingVars.join(', '));
  console.log('Por favor, crea un archivo .env.local basado en .env.local.example y proporciona las credenciales de Firebase.');
}

// Instrucciones para configurar Firebase:
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un nuevo proyecto o selecciona uno existente
// 3. Haz clic en "</>" para agregar una aplicación web
// 4. Registra tu aplicación y copia la configuración
// 5. Reemplaza los valores anteriores con los de tu proyecto
// 6. Habilita Firestore en tu proyecto de Firebase:
//    - Ve a la pestaña "Firestore Database"
//    - Haz clic en "Crear base de datos"
//    - Selecciona "Comenzar en modo de prueba"
//    - Elige una ubicación para tu base de datos
// 7. Configura las reglas de seguridad si es necesario
