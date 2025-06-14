# Sistema de Persistencia de Datos

Este es un servidor Node.js con Express que proporciona una API RESTful para manejar operaciones CRUD en un archivo JSON como base de datos.

## Características

- Almacenamiento seguro en archivo JSON (`db.json`)
- Operaciones CRUD completas
- Autenticación básica
- Sistema de respaldo automático
- Validación de datos
- Manejo de errores

## Requisitos Previos

- Node.js (v14 o superior)
- npm (v6 o superior)

## Instalación

1. Clona el repositorio
2. Navega al directorio del proyecto
3. Instala las dependencias:

```bash
npm install express express-basic-auth uuid dotenv
```

## Configuración

1. Copia el archivo `.env.example` a `.env`
2. Configura las variables de entorno según sea necesario:
   - `PORT`: Puerto del servidor (por defecto: 3001)
   - `ADMIN_USER`: Nombre de usuario para autenticación básica
   - `ADMIN_PASSWORD`: Contraseña para autenticación básica
   - `NODE_ENV`: Entorno de ejecución (development/production)

## Uso

1. Inicia el servidor:

```bash
node server/server.js
```

2. El servidor estará disponible en `http://localhost:3001`

## Endpoints

### Obtener todos los registros
```
GET /api/items
```

### Crear un nuevo registro
```
POST /api/items
```
Ejemplo de cuerpo de la petición:
```json
{
  "name": "Ejemplo",
  "description": "Descripción del ejemplo",
  "amount": 100.50
}
```

### Eliminar un registro
```
DELETE /api/items/:id
```

## Autenticación

Todas las rutas requieren autenticación básica HTTP. Usa las credenciales configuradas en el archivo `.env`.

## Estructura de Datos

Los datos se almacenan en `db.json` con la siguiente estructura:

```json
{
  "items": [
    {
      "id": "uuid-v4",
      "name": "Ejemplo",
      "description": "Descripción",
      "amount": 100.50,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

## Copias de Seguridad

Se crean copias de seguridad automáticamente en el directorio `backups/` antes de cada modificación de datos.
