import { describe, it, expect } from 'vitest';
const request = require('supertest');
const { app } = require('../../index');

describe('Integración: Rutas de la API', () => {
    it('GET / - debería retornar "hello world"', async () => {
        const response = await request(app).get('/');
        
        expect(response.status).toBe(200);
        expect(response.text).toBe('hello world');
    });

    it('GET /ruta-inexistente - debería manejar el error de ruta no encontrada', async () => {
        const response = await request(app).get('/ruta-absolutamente-inexistente');
        
        // Express por defecto devuelve un 404 para rutas inexistentes (si no hay middleware específico)
        expect(response.status).toBe(404);
    });
});
