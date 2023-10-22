const express = require('express');
const router = express.Router();
const BetaListController = require('../controllers/betaListController');

router.post('/store', BetaListController.store);
router.get('/', BetaListController.index);
router.delete('/delete-multiple', BetaListController.deleteMultiple);
router.get('/:id', BetaListController.show);
router.put('/edit/:id', BetaListController.update);
router.delete('/destroy/:id', BetaListController.destroy);
router.post('/emailInviteToUser/:email', BetaListController.emailInviteToUser);
router.post('/emailInviteToUsers', BetaListController.emailInviteToUsers);
router.post('/emailTemplateToUsers', BetaListController.emailTemplateToUsers);
module.exports = router;