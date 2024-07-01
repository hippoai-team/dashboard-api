const express = require('express');
const router = express.Router();
const ec2Controller = require('../controllers/ec2Controller');

router.post('/start', ec2Controller.startInstance);
router.post('/stop', ec2Controller.stopInstance);
router.get('/check-state', ec2Controller.checkInstanceState);
router.post('/check-docker-status', ec2Controller.checkDockerStatus);
router.post('/start-docker', ec2Controller.startDockerContainer);
router.post('/stop-docker', ec2Controller.stopDockerContainer);

module.exports = router;