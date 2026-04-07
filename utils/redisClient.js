const { createClient } = require('redis');

let client;

/**
 * Singleton para obtener el cliente de Redis. 
 * Reutiliza la conexión entre invocaciones de AWS Lambda.
 */
const getRedisClient = async () => {
    // Si no hay URL de Redis configurada, no intentamos conectar
    if (!process.env.REDIS_URL) {
        return null;
    }

    if (!client) {
        try {
            client = createClient({
                url: process.env.REDIS_URL,
                socket: {
                    tls: true, // Requerido para Upstash/Redis Cloud en Lambda
                    rejectUnauthorized: false
                }
            });

            client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                client = null; // Reiniciamos el cliente si hay un error fatal
            });

            await client.connect();
            console.log('Redis connected successfully (Singleton)');
        } catch (err) {
            console.error('Failed to connect to Redis:', err.message);
            client = null;
            return null;
        }
    }
    return client;
};

module.exports = getRedisClient;
