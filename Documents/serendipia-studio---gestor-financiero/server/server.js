require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const basicAuth = require('express-basic-auth');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'db.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Middleware
app.use(express.json());

// Basic Authentication
const users = {
    [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD || 'admin123'
};

const auth = basicAuth({
    users,
    challenge: true,
    unauthorizedResponse: { error: 'Acceso no autorizado' }
});

// Ensure backup directory exists
const ensureBackupDir = async () => {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating backup directory:', error);
    }
};

// Initialize database file if it doesn't exist
const initializeDatabase = async () => {
    try {
        await fs.access(DB_FILE);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(DB_FILE, JSON.stringify({ items: [] }, null, 2));
            console.log('Database file created successfully');
        } else {
            console.error('Error initializing database:', error);
            throw error;
        }
    }
};

// Create backup of the database
const createBackup = async () => {
    try {
        await ensureBackupDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `db_backup_${timestamp}.json`);
        const data = await fs.readFile(DB_FILE, 'utf8');
        await fs.writeFile(backupFile, data);
        return backupFile;
    } catch (error) {
        console.error('Error creating backup:', error);
        throw error;
    }
};

// Read database
const readDatabase = async () => {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        throw error;
    }
};

// Write to database
const writeDatabase = async (data) => {
    try {
        await createBackup();
        await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to database:', error);
        throw error;
    }
};

// Routes
app.get('/api/items', auth, async (req, res) => {
    try {
        const db = await readDatabase();
        res.json(db.items || []);
    } catch (error) {
        res.status(500).json({ error: 'Error al leer los datos' });
    }
});

app.post('/api/items', auth, async (req, res) => {
    try {
        const { body } = req;
        if (!body || Object.keys(body).length === 0) {
            return res.status(400).json({ error: 'Datos no válidos' });
        }

        const db = await readDatabase();
        const newItem = {
            id: uuidv4(),
            ...body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        db.items = db.items || [];
        db.items.push(newItem);
        
        await writeDatabase(db);
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ error: 'Error al crear el registro' });
    }
});

app.delete('/api/items/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDatabase();
        
        const initialLength = db.items ? db.items.length : 0;
        db.items = db.items ? db.items.filter(item => item.id !== id) : [];
        
        if (db.items.length === initialLength) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        
        await writeDatabase(db);
        res.status(200).json({ message: 'Registro eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Error al eliminar el registro' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

// Start server
const startServer = async () => {
    try {
        await ensureBackupDir();
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app; // For testing purposes
