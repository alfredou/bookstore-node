const express = require("express")
const Order = require("../Models/Order")
const User = require("../Models/User")
require('dotenv').config()
const router2 = express.Router()
const stripe = require('stripe')(process.env.STRIPE_KEY)
const NewPrice = require('../newPrice')
const { sendMail } = require('../Routes/email')
const getRedisClient = require('../utils/redisClient'); // Singleton
const crypto = require('crypto');

router2.post('/create-checkout-session', async (req, res) => {
    try {
        const redis = await getRedisClient();
        
        let metadataToSave = {
            userId: req.body.userId
        };

        if (redis) {
            // Si Redis funciona, usamos la estrategia limpia
            const tempCartId = `temp_cart_${crypto.randomUUID()}`;
            const cartData = {
                userId: req.body.userId,
                products: req.body.NcartItems
            };
            await redis.setEx(tempCartId, 14400, JSON.stringify(cartData));
            metadataToSave.tempCartId = tempCartId;
        } else {
            // FALLBACK a MongoDB si no hay Redis configurado o se cae
            const newOrder = new Order({
                userId: req.body.userId,
                products: req.body.NcartItems,
                subtotal: 0,
                total: 0,
                shipping: {},
                payment_status: "pending"
            });
            const savedOrder = await newOrder.save();
            metadataToSave.fallbackOrderId = savedOrder._id.toString();
        }

        const customer = await stripe.customers.create({
            metadata: metadataToSave
        });

        const line_items = req.body.NcartItems.map(item => {
            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.title,
                        images: [item.image],
                        metadata: {
                            id: item.id
                        },
                    },
                    unit_amount: item.price * 100,
                },
                quantity: item.quantity,
            }
        })

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            shipping_address_collection: { allowed_countries: ['US', 'CA', 'MX'] },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: 0, currency: 'usd' },
                        display_name: 'Free shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 5 },
                            maximum: { unit: 'business_day', value: 7 },
                        },
                    },
                },
            ],
            phone_number_collection: {
                enabled: true
            },
            customer: customer.id,
            line_items: line_items,
            mode: 'payment',
            invoice_creation: {
                enabled: true
            },
            success_url: `${process.env.CLIENT_URL}/success`,
            cancel_url: `${process.env.CLIENT_URL}`,
        });

        res.send({ url: session.url });
    } catch (error) {
        console.error("Stripe Checkout Error:", error);
        res.status(500).send({ error: error.message });
    }
});

//create order helper
const createOrder = async (customer, data) => {
    const tempCartId = customer.metadata.tempCartId;
    const fallbackOrderId = customer.metadata.fallbackOrderId;
    const redis = await getRedisClient();
    
    try {
        let savedOrder;

        if (tempCartId && redis) {
            // Recuperamos el carrito de Redis
            const cartJson = await redis.get(tempCartId);
            
            if (cartJson) {
                const { userId, products } = JSON.parse(cartJson);

                // AHORA SÍ creamos la orden definitiva en MongoDB (porque ya está pagada)
                const newOrder = new Order({
                    userId: userId,
                    customerId: data.customer,
                    paymentIntentId: data.payment_intent,
                    products: products,
                    subtotal: data.amount_subtotal / 100, // Stripe devuelve centavos
                    total: data.amount_total / 100,
                    shipping: data.customer_details,
                    payment_status: data.payment_status
                });

                savedOrder = await newOrder.save();
                
                // Limpiamos Redis
                await redis.del(tempCartId);
                await redis.del(`orders_user:${userId}`);
            }
        } else if (fallbackOrderId) {
            // Si usamos el fallback de MongoDB, actualizamos la orden temporal
            const order = await Order.findById(fallbackOrderId);
            if (order) {
                order.customerId = data.customer;
                order.paymentIntentId = data.payment_intent;
                order.subtotal = data.amount_subtotal / 100;
                order.total = data.amount_total / 100;
                order.shipping = data.customer_details;
                order.payment_status = data.payment_status;
                savedOrder = await order.save();
            }
        }

        // Si logramos guardar la orden (por Redis o Mongo), adjuntamos la factura
        if (savedOrder && data.invoice) {
            try {
                const invoice = await stripe.invoices.retrieve(data.invoice);
                if (invoice) {
                    savedOrder.invoice_url = invoice.hosted_invoice_url;
                    savedOrder.invoice_pdf = invoice.invoice_pdf;
                    await savedOrder.save();
                }
            } catch (invErr) {
                console.log("Error retrieving invoice details:", invErr.message);
            }
        }

    } catch (err) {
        console.error("Error finalizing order:", err);
    }
}

//stripe webhook
router2.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let data;
    let eventType;
    let event;

    if (process.env.ENDPOINT_SECRET) {
        try {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.ENDPOINT_SECRET);
        } catch (err) {
            console.log(`Webhook Error: ${err.message}`)
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }
        data = event.data.object
        eventType = event.type
    } else {
        data = req.body.data.object
        eventType = req.body.type
    }

    if (eventType === "checkout.session.completed") {
        stripe.customers.retrieve(data.customer).then((customer) => {
            createOrder(customer, data)
        }).catch(err => console.log(err))
    }
    res.send().end();
});

module.exports = router2
