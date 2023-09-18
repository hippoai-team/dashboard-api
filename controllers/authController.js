const { comparePassword, hashPassword } = require('../helpers/authHelper.js');
const userModel = require('../models/userModel.js');
const JWT = require('jsonwebtoken');


const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        // validation
        if(!email || !password ) {
            return res.status(404).send({
                success: false,
                message: 'Invalid email or password'
            })
        }
        // check user
        const user = await userModel.findOne({ email }).maxTimeMS(15000);
        if(!user) {
            return res.status(404).send({
                success: false,
                message: 'user not found'
            })
        }

        const match = await comparePassword(password, user.password);

        if(!match) {
            return res.status(404).send({
                success: false,
                message: 'invalid Password'
            })
        }

        // token
        const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        })

        res.status(200).send({
            success: true,
            message: "login successful",
            user: {
                email: email
            },
            token
        });

    } catch (error) {
        console.log(error);
        res.status(500).send({  
            success: false,
            message: 'error in login',
            error
        })
    }
}


const registerController = async (req, res) => {
    try {
        const { email, password, role }  = req.body;
     
        if(!email) {
            return res.send({ error: 'email is required'});
        }
        if(!password) {
            return res.send({ error: 'password is required'});
        }

        // existing users
        const existingUser = await userModel.findOne({ email }).maxTimeMS(15000); // Set a 15-second timeout for the query

        if(existingUser) {
            return res.status(200).send({
                success: true,
                message: 'email already registered'
            })
        }

        // register user
        const hashedPassword = await hashPassword(password);
        // save
        const user = new userModel({ email, role, password: hashedPassword}).save();
     
        res.status(201).send({
            success: true,
            message: 'User registered successfully',
            user
        })
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: 'Error in registration',
            error
        })
    }
};


const testController = (req, res) => {
    res.send('protected route');
}

module.exports = {
    loginController,
    registerController,
    testController
};
