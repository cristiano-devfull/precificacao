import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import createPreferenceHandler from './api/create-preference.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota Mercado Pago
app.post('/api/create-preference', createPreferenceHandler);

// Servir arquivos estáticos (HTML, CSS, JS, Assets)
app.use(express.static(__dirname));

// Fallback para rota raiz
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

