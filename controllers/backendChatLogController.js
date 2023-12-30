const BackendChatLog = require('../models/BackendChatLog');

exports.index = async (req, res) => {
    const backendchatlog = await BackendChatLog.find();
    res.render('backendchatlog/index', { backendchatlog: backendchatlog });
};