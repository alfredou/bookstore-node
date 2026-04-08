import { describe, it, expect } from 'vitest';
const createError = require('../../utils/error');

describe('Utils: createError', () => {
    it('debería crear un objeto de error con el status y mensaje correctos', () => {
        const error = createError(404, 'No encontrado');
        
        expect(error).toBeInstanceOf(Error);
        expect(error.status).toBe(404);
        expect(error.message).toBe('No encontrado');
    });

    it('debería funcionar con códigos de error internos', () => {
        const error = createError(500, 'Error interno');
        
        expect(error.status).toBe(500);
        expect(error.message).toBe('Error interno');
    });
});
