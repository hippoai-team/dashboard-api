const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiController');

router.get('/get-kpi', kpiController.index);

module.exports = router;