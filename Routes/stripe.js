const express = require("express")
const Order = require("../Models/Order")
const User = require("../Models/User")
require('dotenv').config()
const router2 = express.Router()
const stripe = require('stripe')(process.env.STRIPE_KEY)
const NewPrice = require('../newPrice')
const { sendMail } = require('../Routes/email')

router2.post('/create-checkout-session', async (req, res) => {
    try {
        // Creamos la orden en la base de datos PRIMERO con estado "pending". 
        // Asi evitamos el limite ridiculo de 500 caracteres de Stripe.
        const newOrder = new Order({
            userId: req.body.userId,
            products: req.body.NcartItems,
            subtotal: 0,
            total: 0,
            shipping: {},
            payment_status: "pending"
        });
        const savedOrder = await newOrder.save();

        const customer = await stripe.customers.create({
            metadata: {
                userId: req.body.userId,
                orderId: savedOrder._id.toString()
            }
        })
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
        //el precio es el del problema arreglar
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
            success_url: `${process.env.CLIENT_URL}/success`,
            cancel_url: `${process.env.CLIENT_URL}`,
        });

        res.send({ url: session.url });
    } catch (error) {
        console.error("Stripe Checkout Error:", error);
        res.status(500).send({ error: error.message });
    }
});

//create order
const createOrder = async (customer, data) => {
    const orderId = customer.metadata.orderId;
    
    if (orderId) {
        try {
            const order = await Order.findById(orderId);
            if (order) {
                order.customerId = data.customer;
                order.paymentIntentId = data.payment_intent;
                order.subtotal = data.amount_subtotal;
                order.total = data.amount_total;
                order.shipping = data.customer_details;
                order.payment_status = data.payment_status;
                const savedOrder = await order.save();
                
                const { redisClient, isCacheConnected } = require('../utils/redisClient');
                if (isCacheConnected()) {
                    try {
                        // Limpiamos la caché del usuario para que vea su nueva orden actualizada de inmediato
                        await redisClient.del(`orders_user:${order.userId}`);
                        await redisClient.del(`orders_single:${order._id}`);
                    } catch(e) {
                        console.log("Redis cache invalidation error:", e.message);
                    }
                }
                //console.log("Processed Order:", savedOrder)
            }
        } catch (err) {
            console.log("Error updating order:", err);
        }
    }
}
//stripe webhook

// This is your Stripe CLI webhook secret for testing your endpoint locally.

//verify that webhook comes from strype added by me
router2.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let data;
    let eventType;
    let event;
    //nota importante el Endpoint_secret que viene del process.env es para probarlo en local, el de probarlo en producción ya seria el endpoint que te da el webhook al momento de crearlo que seria el secreto de firma o el endpoint secret.
    if (process.env.ENDPOINT_SECRET) {

        try {
            //cambie el req.body a req.rawBody porque lo añadi en el index
            /*console.log("secret", process.env.ENDPOINT_SECRET)
            console.log("sig", sig)
            console.log("raw", req.rawBody)*/
            event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.ENDPOINT_SECRET);
            console.log('webhook verified')
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
    //handle the event
    if (eventType === "checkout.session.completed") {
        console.log("eventType", req.body.type)
        //la info del cliente vendra de la info almacenada en data que contiene toda la información del cliente
        //es decir la que el cliente coloco en los campos del formulario y yo manejo en la sessión
        stripe.customers.retrieve(data.customer).then((customer) => {
            createOrder(customer, data)
        }).catch(err => console.log(err))
    }
    // Return a 200 response to acknowledge receipt of the event
    res.send().end();
});

module.exports = router2
