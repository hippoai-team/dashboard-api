const mongoose = require('mongoose');


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
    rate_limit: {
        monthly_limit: {
            type: Number,
            default: 500
        },
        base_cost_month: {
            type: Number,
            default: 200
        },
        overage_charge_per_use: {
            type: Number,
            default: 0.10  // Default $0.10 per use over limit
        }
    }
});


const APICustomer = mongoose.model('api_customer', apiCustomerSchema, 'api_keys');

module.exports = APICustomer;