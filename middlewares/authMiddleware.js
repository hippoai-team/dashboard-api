
const JWT = require("jsonwebtoken");
const userModel = require("../models/userModel.js");

const requireSignIn = async (req, res, next) => {
    try {
        const decode = JWT.verify(req.headers.authorization, process.env.JWT_SECRET);
        req.user = decode;
        next();
    } catch (error) {
        console.log(error);
        res.status(401).send({
            success: false,
            message: 'sign in error'
        });
    }
}


module.exports = {
    requireSignIn
};