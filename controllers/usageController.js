const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const UsageEntry = require("../models/UsageEntry");
const APICustomer = require("../models/APICustomer");
const BackendChatLog = require("../models/BackendChatLog");

const modelPricing = {
    "gpt-4-1106-preview": {
        "input": 0.00001,  // $0.00001 per token
        "output": 0.00003  // $0.00003 per token
    },
    "gpt-4-0314": {
        "input": 0.00003,  // $0.00003 per token
        "output": 0.00006  // $0.00006 per token
    },
    "gpt-3.5-turbo": {
        "input": 0.0000010,  // $0.0000010 per token
        "output": 0.0000020  // $0.0000020 per token
    }
};

exports.index = async (req, res) => {
    try {
        console.log('fetching usage entries');
        const page = parseInt(req.query.page) || 1; // Get the requested page or default to page 1
        const perPage = parseInt(req.query.perPage) || 50; // Get the requested number of items per page or default to 10
        const skip = (page - 1) * perPage;
        const customer_key = req.query.customer || "";
        const month = req.query.month || "";
        const query = {};
        const months = await UsageEntry.aggregate([
            { $match: query },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } }
            }},
            { $sort: { "_id": -1 } }
        ])
        if (month) {
            const startDate = new Date(month);
            const endDate = new Date(month);
            endDate.setMonth(endDate.getMonth() + 1);
            query.timestamp = { $gte: startDate, $lt: endDate };
        }
        //total usage entries this month
        const totalUsageEntries = await UsageEntry.countDocuments(query);
        if (customer_key) {
            query.api_key = customer_key;
        }
       
        //total usage entries for selected customer
        const totalUsageEntriesForSelectedCustomer = await UsageEntry.countDocuments(query);
        const totalUsagePercentageForSelectedCustomer = (totalUsageEntriesForSelectedCustomer / totalUsageEntries)
        
        //get all api customers
        const apiCustomers = await APICustomer.find({});
        let usageEntries = [];
        if (query.api_key && query.timestamp) {
            //get all usage entries
            usageEntries = await UsageEntry.aggregate([
                { $match: query },
                { $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                        model: "$model"
                    },
                    total_input_count: { $sum: "$input_count" },
                    total_output_count: { $sum: "$output_count" }
                }},
                { $sort: { "_id.date": 1, "_id.model": 1 } }
            ]);
        }

        //if usageEntries, calculate total input and output cost using modelPricing
        if (usageEntries.length) {
            usageEntries.forEach(entry => {
                const model = modelPricing[entry._id.model] ? entry._id.model : "gpt-4-1106-preview";
                entry.total_input_cost = entry.total_input_count * modelPricing[model].input;
                entry.total_output_cost = entry.total_output_count * modelPricing[model].output;
            });
        }
        const query_logs = {};

        if (month) {
            const startDate = new Date(month);
            const endDate = new Date(month);
            endDate.setMonth(endDate.getMonth() + 1);
            query_logs.timestamp = { $gte: startDate, $lt: endDate };
        }

        //total chat logs this month
        const totalChatLogs = await BackendChatLog.countDocuments(query_logs);
        console.log('usageEntries', usageEntries);
        //get all chat logs
       
        if (customer_key) {
            query_logs.api_key = customer_key;
        }
       
        const chatLogs = await BackendChatLog.find(query_logs).sort({ timestamp: -1 }).skip(skip).limit(perPage);

        //return api customers and usage entries

        const data = { apiCustomers, usageEntries, chatLogs, months, totalUsagePercentageForSelectedCustomer};
        console.log('data', data);
        res.status(200).json(data);
    }
    catch (error) {
        console.log('error', error);
        res.status(400).json({ error: "Failed to get usage entries" });
    }
}
