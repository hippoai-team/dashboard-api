const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

pendium_db = mongoose.createConnection(process.env.MONGO_URL_2, {
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


const APICustomer = pendium_db.model('api_customer', apiCustomerSchema, 'api_keys');

module.exports = APICustomer;