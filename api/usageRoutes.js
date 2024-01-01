const express = require('express');
const router = express.Router();

const UsageController = require('../controllers/usageController');

router.get('/', UsageController.index);
router.get('/:id', UsageController.show);
router.post('/emailBilling:email', UsageController.emailBilling);

module.exports = router;