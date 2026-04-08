require('dotenv').config();
const connect = require('./db.js');
const express = require('express')
const app = express()
const cors = require('cors')
const verifyToken = require('./middlewares/verifyToken')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser'); // Agrega body-parser
const limiter = require('./utils/rateLimit.js')
const serverless = require('serverless-http'); // Importamos serverless-http
const helmet = require('helmet'); // Capa de seguridad HTTP
const mongoSanitize = require('express-mongo-sanitize'); // Prevenir NoSQL Injection
//const {sendMail} = require('./Routes/email')
//app.use(express.json())
//añadido de comentario útil del video

/**mejorar el backend para mañana hacer implementación de paypal si da tiempo, y también la de enviar correos esto para el formulario de contacto y la newsletter y las validaciones y demas
 * usar vscode si no funciona la IA
 * ver que otras cosas puedo tocar
*/
app.use(limiter)
app.use(helmet()) // Activa todas las protecciones HTTP de Helmet
app.use(mongoSanitize()) // Limpia los inputs contra Inyecciones de Mongo

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-source']
}))
app.use(cookieParser())
//app.use(cors())

app.use(
    express.json({
        limit: "5mb",
        verify: (req, res, buf) => {
            req.rawBody = buf.toString();
        },
    })
);



const userRouter = require('./Routes/user')
const router = require('./Routes/auth')
const stripe = require('./Routes/stripe')
//const paypal = require('./Routes/paypal')
const commentRouter = require('./Routes/comment')


app.get("/", (req, res) => {
    res.send("hello world")
})
app.get('/api/logout', verifyToken, async (req, res) => {
    try {
        res.clearCookie('access_token', { httpOnly: true });
        res.send('Sesión cerrada');
    } catch (e) {
        res.send({ message: e })
    }
});

app.use("/api/auth", router)
app.use("/api/user", verifyToken, userRouter)
app.use("/api/comment", commentRouter)
/*
app.use(bodyParser.json({
    // Because Stripe needs the raw body, we compute it but only when hitting the Stripe callback URL.
    verify: function(req,res,buf) {
        var url = req.originalUrl;
        if (url.startsWith('/api/stripe')) {
            req.rawBody = buf.toString()
        }
    }}));
*/
app.use("/api/stripe", verifyToken, stripe)
//app.use("/api/paypal", paypal)

app.get("/item", verifyToken, (req, res) => {
    res.send("<h1>Tienes acceso</h1>")
})
app.use((err, req, res, next) => {

    const errorStatus = err.status || 500
    const errorMessage = err.message || "Something went wrong"
    return res.status(errorStatus).json({
        success: false,
        status: errorStatus,
        message: errorMessage,
        stack: err.stack //explica el error con mas detalle
    })
})
// Exportamos el handler para AWS Lambda y la app para testing (supertest)
module.exports.handler = serverless(app);
module.exports.app = app;

// Solo escuchamos en un puerto si no estamos en AWS Lambda (es decir, localmente) y no estamos en un test
if (!process.env.LAMBDA_TASK_ROOT && process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        connect();
        console.log(`Server running locally on port ${PORT}`);
    });
} else if (process.env.LAMBDA_TASK_ROOT) {
    // En Lambda, conectamos a la DB al iniciar la función
    connect();
}