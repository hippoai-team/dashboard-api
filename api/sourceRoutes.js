const express = require('express');
const router = express.Router();
const SourceController = require('../controllers/sourceController');

router.post('/store', SourceController.store);
router.get('/', SourceController.index);
router.delete('/delete-multiple', SourceController.deleteMultiple);
router.get('/:id', SourceController.show);
router.put('/edit/:id', SourceController.update);
router.delete('/destroy/:id', SourceController.destroy);
router.post('/process/:id', SourceController.process);
router.post('/process-multiple', SourceController.processMultiple);


module.exports = router;

