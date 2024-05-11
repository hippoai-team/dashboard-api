const express = require('express');
const router = express.Router();
const newSourceController = require('../controllers/newSourceController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/store', upload.single('pdfFile'), newSourceController.store);
router.get('/', newSourceController.index);
router.get('/:id', newSourceController.show);
router.put('/edit/:id', newSourceController.update);
router.post('/approve', newSourceController.approve);
router.post('/process', newSourceController.process);
router.post('/status', newSourceController.getPipelineStatus);
router.post('/reject', newSourceController.reject);
router.post('/delete', newSourceController.delete);
router.post('/store', newSourceController.store);
router.put('/update', upload.single('pdfFile'), newSourceController.update);
module.exports = router;
