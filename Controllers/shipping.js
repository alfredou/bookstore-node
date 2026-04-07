const EasyPost = require('@easypost/api');
const Order = require('../Models/Order');
const client = new EasyPost(process.env.EASYPOST_API_KEY);

// Esta ruta genera una etiqueta de envío real basada en una orden pagada
const createShippingLabel = async (req, res) => {
    const { orderId } = req.body;

    try {
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).send("Order not found");
        if (order.payment_status !== 'paid') return res.status(400).send("Order is not paid yet");

        // 1. Configuramos el remitente (Tu dirección de la librería)
        const fromAddress = await client.Address.create({
            company: 'Mi Bookstore Increíble',
            street1: '123 Main St', // <- Pon tu dirección real aquí o en .env
            city: 'Miami',
            state: 'FL',
            zip: '33101',
            country: 'US',
            phone: '555-555-5555'
        });

        // 2. Configuramos el destinatario (Sacado de los datos de Stripe)
        const toAddress = await client.Address.create({
            name: order.shipping.name,
            street1: order.shipping.address.line1,
            street2: order.shipping.address.line2 || '',
            city: order.shipping.address.city,
            state: order.shipping.address.state,
            zip: order.shipping.address.postal_code,
            country: order.shipping.address.country,
            phone: order.shipping.phone // Stripe lo captura si lo activamos
        });

        // 3. Definimos el paquete (Estimación de peso/tamaño de un libro promedio)
        const parcel = await client.Parcel.create({
            length: 10,
            width: 7,
            height: 2,
            weight: 24 // onzas (aprox 1.5 libras por un libro)
        });

        // 4. Creamos el envío (Shipment) para obtener tarifas (Rates)
        const shipment = await client.Shipment.create({
            from_address: fromAddress,
            to_address: toAddress,
            parcel: parcel,
        });

        // 5. Compramos la tarifa más barata automáticamente (USPS suele serlo)
        const boughtShipment = await client.Shipment.buy(shipment.id, shipment.lowestRate());

        // 6. Guardamos los resultados finales en tu MongoDB
        order.tracking_number = boughtShipment.tracking_code;
        order.tracking_url = boughtShipment.tracker.public_url;
        order.shipping_label = boughtShipment.postage_label.label_url;
        order.shipping_id = boughtShipment.id;
        order.delivery_status = "shipped"; // Actualizamos el estado

        await order.save();

        res.status(200).json({
            message: "Shipping label created successfully!",
            tracking: order.tracking_number,
            label: order.shipping_label
        });

    } catch (error) {
        console.error("EasyPost Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { createShippingLabel };
