const express = require('express');
const router = express.Router();

const UsageController = require('../controllers/usageController');

router.get('/', UsageController.index);

module.exports = router;