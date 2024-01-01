const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const UsageEntry = require("../models/UsageEntry");
const APICustomer = require("../models/APICustomer");


exports.index = async (req, res) => {
    try {
        console.log('fetching usage entries');
        const page = parseInt(req.query.page) || 1; // Get the requested page or default to page 1
        const perPage = parseInt(req.query.perPage) || 10; // Get the requested number of items per page or default to 10
        const skip = (page - 1) * perPage;

        //get all api customers
        const apiCustomers = await APICustomer.find({});
        //get all usage entries
        const usageEntries = await UsageEntry.find({}).sort({ timestamp: -1 }).skip(skip).limit(perPage);

        //return api customers and usage entries
        res.status(200).json({ apiCustomers, usageEntries });
    }
    catch (error) {
        console.log('error', error);
        res.status(400).json({ error: "Failed to get usage entries" });
    }
}
