const express = require('express');
const router = express.Router();
const backendChatLogController = require('../controllers/backendchatlogController');

router.get('/', backendChatLogController.index);

module.exports = router;