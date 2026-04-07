const express = require('express');
const { createShippingLabel } = require('../Controllers/shipping');
const shippingRouter = express.Router();
const verifyToken = require('../middlewares/verifyToken');

// Implementamos la creación de etiqueta de envío masiva
shippingRouter.post('/create-label', verifyToken, createShippingLabel);

module.exports = shippingRouter;
