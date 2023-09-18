const express = require('express');
const router = express.Router();
const BookController = require('../controllers/BookController');

router.post('/store', BookController.store);
router.get('/', BookController.index);
router.delete('/delete-multiple', BookController.deleteMultiple);
router.get('/:id', BookController.show);
router.put('/edit/:id', BookController.update);
router.delete('/destroy/:id', BookController.destroy);


module.exports = router;

