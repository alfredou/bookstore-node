const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

const connect = async () => {
    try {
        await mongoose.connect(process.env.MONGO);
        console.log('connected to mongodb')
    } catch (error) {
        throw error
    }
}
mongoose.connection.on("disconnected", () => {
    console.log("mongodb disconnected")
})
mongoose.connection.on("connected", () => {
    console.log("mongodb connected")
})

module.exports = connect