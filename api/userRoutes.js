const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.index);
router.get('/:id', userController.show);
router.post('/', userController.createUser);
router.put('/edit/:id', userController.updateUser);
router.delete('/delete/:id', userController.delete);
router.post('/delete-multiple', userController.deleteMultiple);


module.exports = router;
