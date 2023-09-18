const express = require('express');
const { loginController, registerController, testController } = require('./../controllers/authController');
const { requireSignIn } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/login', loginController);
router.post('/register', registerController);
router.get('/test', requireSignIn, testController);
router.get('/user-auth', requireSignIn, (req, res) => {
    res.status(200).send({ ok: true });
})

module.exports = router;
