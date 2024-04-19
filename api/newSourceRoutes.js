const express = require('express');
const router = express.Router();
const newSourceController = require('../controllers/newSourceController');

router.post('/store', newSourceController.store);
router.get('/', newSourceController.index);
router.delete('/delete-multiple', newSourceController.deleteMultiple);
router.get('/:id', newSourceController.show);
router.put('/edit/:id', newSourceController.update);
router.delete('/destroy/:id', newSourceController.destroy);
router.post('/approve', newSourceController.approve);
router.post('/approve-multiple', newSourceController.approveMultiple);
router.post('/process', newSourceController.process);
router.post('/process-multiple', newSourceController.processMultiple);
router.post('/status', newSourceController.getPipelineStatus);
module.exports = router;
