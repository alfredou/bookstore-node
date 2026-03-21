const { Comment } = require('../Models/Comment')
const User = require('../Models/User')
const { redisClient, isCacheConnected } = require('../utils/redisClient')

const getComments = async (req, res, next) => {
    const id = req.params.id
    
    try {
        // --- REDIS CACHE CHECK ---
        if (isCacheConnected()) {
            try {
                const cachedComments = await redisClient.get(`comments:${id}`);
                if (cachedComments) {
                    return res.status(200).json(JSON.parse(cachedComments));
                }
            } catch (cacheErr) {
                console.log("Redis read error:", cacheErr.message);
            }
        }
        // -------------------------

        const comments = await Comment.find({bookisbn: id}).populate('user', {
            username: 1,
        })
        if(!comments || comments.length === 0) return res.status(204).send("User doesn't have comments")

          let totalSum = 0
          comments.forEach((item, index)=>{
                totalSum = totalSum + item.rating
          })
          
        let productRating = (totalSum / comments.length)
        const responseData = { comments, productRating };
        
        // --- REDIS CACHE SAVE ---
        if (isCacheConnected()) {
            try {
                await redisClient.setEx(`comments:${id}`, 3600, JSON.stringify(responseData));
            } catch (cacheErr) {
                console.log("Redis save error:", cacheErr.message);
            }
        }
        // ------------------------

        res.status(200).json(responseData)
    }catch(e){
        //console.log(e)
        res.status(400).json({error: e.name})
    }
}

const sendComment = async (req, res, next) => {
       const {bookisbn, rating, comment, userId} = req.body
    try {
         const user = await User.findById(userId)
           
         const userComment = new Comment({
               bookisbn,
               rating,
               comment,
               user: user._id
           })

        const savedComment = await userComment.save()
        user.comments = user.comments.concat(savedComment._id)
        await user.save();

        // --- REDIS CACHE INVALIDATION ---
        if (isCacheConnected()) {
            try {
                await redisClient.del(`comments:${bookisbn}`);
            } catch (cacheErr) {
                console.log("Redis delete error:", cacheErr.message);
            }
        }
        // --------------------------------

        res.status(200).send("Comment saved sucessfully")

        } catch(e){
           res.status(400).json({error: e.name})
       }
}

module.exports = {getComments, sendComment}