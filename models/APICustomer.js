const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI_2, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const apiCustomerSchema = new mongoose.Schema({
  
    customer_email: String,
    customer_name: String,
    api_key: String,
    customer_id: String,
    date_created: {
        type: Date,
        default: Date.now,
    },
    date_expires: {
        type: Date,
        default: Date.now,
    },
    status: String,
    permissions: String,
    rate_limit: String,
});


const APICustomer = mongoose.model('api_keys', apiCustomerSchema);