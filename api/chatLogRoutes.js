const express = require('express');
const router = express.Router();
const chatLogController = require('../controllers/chatLogController');

router.get('/', chatLogController.index);

module.exports = router;