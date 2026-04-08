import { describe, it, expect } from 'vitest';
const request = require('supertest');
const { app } = require('../../index');

describe('Integración: Seguridad y Rutas Protegidas', () => {

    describe('Middleware verifyToken', () => {
        it('GET /api/user/:id - debería denegar acceso sin cookie de token (401)', async () => {
            const response = await request(app)
                .get('/api/user/12345')
                .set('x-client-source', 'bookstore-react-app');
            
            // Falla correctamente porque no adjuntamos cookies con JWT válido
            expect(response.status).toBe(401);
            expect(response.body.message).toBe("No token provided"); 
        });

        it('POST /api/stripe/create-checkout-session - Ruta VITAL protegida', async () => {
            // Test recomendado: Asegurarse de que un pirata no pueda crear sesiones de Stripe sin estar logueado
            const response = await request(app)
                .post('/api/stripe/create-checkout-session')
                .set('x-client-source', 'bookstore-react-app')
                .send({
                    userId: "123",
                    NcartItems: []
                });
            
            expect(response.status).toBe(401);
            expect(response.body.message).toBe("No token provided");
        });
    });

});
