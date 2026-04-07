const Order = require('../Models/Order')
const createError = require('../utils/error')
const getRedisClient = require('../utils/redisClient')


const getOrder = async (req, res, next)=>{
  const id = req.params.id
    try{
        const redis = await getRedisClient();
        if (redis) {
            try {
                const cachedOrders = await redis.get(`orders_user:${id}`);
                if (cachedOrders) return res.status(200).send(JSON.parse(cachedOrders));
            } catch (err) { console.log(err) }
        }

        const order = await Order.find({userId: id})
        if(!order) return res.status(400).send("The order doesn't exist")

        const orders = order.map((item, index)=>{
          const result = {
              _id: item._id, 
              userId: item.userId, 
              total: item.total, 
              payment_status:item.payment_status, 
              createdAt: item.createdAt
          }
          return result
        })
        
        if (redis) {
            try {
                await redis.setEx(`orders_user:${id}`, 3600, JSON.stringify(orders));
            } catch (err) { console.log(err) }
        }

        res.status(200).send(orders)
    }
    catch(e){
       res.json({error: e.name})
    }
}

const getOrders = async (req, res, next)=>{
    const id = req.params.id
      try{
            const redis = await getRedisClient();
            if (redis) {
                try {
                    const cachedOrder = await redis.get(`orders_single:${id}`);
                    if (cachedOrder) return res.status(200).send(JSON.parse(cachedOrder));
                } catch (err) { console.log(err) }
            }

            const orders = await Order.findById(id)
            if(!orders) return res.status(400).send("The order doesn't exist")

            if (redis) {
                try {
                    await redis.setEx(`orders_single:${id}`, 3600, JSON.stringify(orders));
                } catch (err) { console.log(err) }
            }

            res.status(200).send(orders)
      }
      catch(e){
            res.status(400).json({error: e.name})
      }
}

module.exports = {getOrder, getOrders}