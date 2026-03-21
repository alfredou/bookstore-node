const { rateLimit } = require('express-rate-limit');

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: "Has excedido el límite de solicitudes. Por favor, intenta de nuevo más tarde."
	// store: ... , // Use an external store for consistency across multiple server instances.
})

module.exports = limiter