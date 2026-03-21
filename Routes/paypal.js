const express = require("express")
const Order = require("../Models/Order")
const User = require("../Models/User")
require('dotenv').config()
const paypalRouter = express.Router()
const request = require('postman-request');

//investigar como funcionan los webhooks en paypal si es similar a stripe
const auth = { user: process.env.PAYPAL_CLIENTID, pass: process.env.PAYPAL_SECRET_KEY }

const createPayment = (req, res) => {

    const body = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD', //https://developer.paypal.com/docs/api/reference/currency-codes/
                value: '115'
            }
        }],
        application_context: {
            brand_name: `Bookstore.com`,
            landing_page: 'NO_PREFERENCE', // Default, para mas informacion https://developer.paypal.com/docs/api/orders/v2/#definition-order_application_context
            user_action: 'PAY_NOW', // Accion para que en paypal muestre el monto del pago
            return_url: `http://localhost:3001/api/paypal/execute-payment`, // Url despues de realizar el pago
            cancel_url: `http://localhost:3001/api/paypal/cancel-payment` // Url despues de realizar el pago
        }
    }
    //https://api-m.sandbox.paypal.com/v2/checkout/orders [POST]
    // para usar los pagos en vivo es decir que se registren los pagos sin el test que es el sandbox Live https://api-m.paypal.com
    // para que no tenga la misma sesion de paypal es decir despues que hayamos realizado el pago en modo personal simulando el usuario: https://www.sandbox.paypal.com/us/signin lo hacemos para loguearnos en modo business
    request.post(`${process.env.PAYPAL_SANDBOXURL}/v2/checkout/orders`, {
        auth,
        body,
        json: true
    }, (err, response) => {
        res.json({ data: response.body })
    })
}

/**
 * Esta funcion captura el dinero REALMENTE
 * @param {*} req 
 * @param {*} res 
 */
const executePayment = (req, res) => {
    const token = req.query.token; //<-----------

    request.post(`${process.env.PAYPAL_SANDBOXURL}/v2/checkout/orders/${token}/capture`, {
        auth,
        body: {},
        json: true
    }, (err, response) => {
        //en caso de que este completado podemos guardar la información en la db y enviar un mensaje
        res.json({ data: response.body })
    })
}

paypalRouter.post(`/create-payment`, createPayment)

/**
 * 3️⃣ Creamos Ruta para luego que el cliente completa el checkout 
 * debemos de capturar el dinero!
 */

paypalRouter.get(`/execute-payment`, executePayment)

module.exports = paypalRouter

//en un hipotetico caso como funcionaria, estos son los pasos a considerar: 

//el flujo de pasos es seleccionar el boton pagar con paypal y este hará una petición post al: http://localhost:3001/api/paypal/create-payment
//luego nos devolvera una lista de urls navegamos a la url de approve solamente devolvemos esa desde el backend o podemos devolverlas todas pero el punto es tratar de mantener la encapsulación de estas url que son importantes
//el usuario se logueara en la ventana de login que mostrara el link y este realizará el pago con la tarjeta que tenga asociada.
//guardaremos la información en la base de datos en caso de que sea exitosa es decir que diga completado guardaremos los datos en la base de datos. 
//también podemos enviar un mensaje en esta parte con nodemailer o resend, o crear una notificación mandando un push un whatsapp etc.

//la ventana redireccionará a la pagina de sucess de nuestro ecomerce si hay error a la pagina de error, es decir la pagina que tengamos configurada como sucess y error.




