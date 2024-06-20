const express = require('express');
const router = express.Router();
const ec2Controller = require('../controllers/ec2Controller');

router.post('/launch', ec2Controller.start);
router.post('/stop', ec2Controller.stop);
router.get('/check-state', ec2Controller.check_instance_state);

module.exports = router;