const { createClient } = require('redis');

// Usamos REDIS_URL para servicios en la nube (como Upstash o Render),
// y localhost como puerto predeterminado si es local.
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

let isConnected = false;

redisClient.on('error', (err) => {
    // Si falla la conexion (por ejemplo, el usuario no tiene redis instalado),
    // no crasheamos el servidor, solo avisamos y deshabilitamos el caché.
    if (isConnected) {
        console.error('Redis Connection Error:', err.message);
    }
});

redisClient.on('connect', () => {
    console.log('Successfully connected to Redis!');
    isConnected = true;
});

// Intentamos conectar silenciosamente
redisClient.connect().catch(() => {
    console.log('Failed to connect to Redis. Running without cache.');
});

// Función asistente amigable para comprobar si podemos usar Redis
const isCacheConnected = () => isConnected && redisClient.isOpen;

module.exports = { redisClient, isCacheConnected };
