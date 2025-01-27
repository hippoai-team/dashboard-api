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
    },
    "gpt-4o": {
        "input": 0.0000010,  // $0.0000010 per token
        "output": 0.0000020  // $0.0000020 per token
    }
};

// Model name mapping
const modelNameMapping = {
    "gpt-4-1106-preview": "HippoAI_V1",
    "gpt-4o": "HippoAI_V2",
    "gpt-3.5-turbo": "HippoAI_Basic"
};

// Helper function to get friendly model name
const getFriendlyModelName = (modelName) => {
    return modelNameMapping[modelName] || modelName;
};

// Helper function to get pricing for a model
const getModelPricing = (modelName) => {
    // Default to gpt-4-1106-preview pricing if model not found
    return modelPricing[modelName] || modelPricing["gpt-4-1106-preview"];
};

// Helper function to generate HTML bill
const generateBillHTML = (customer, usage, rateLimitUsage, month) => {
    const [year, month_num] = month.split('-');
    const monthDate = new Date(year, month_num - 1); // month is 0-based in Date constructor
    const monthString = monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    
    // Transform model names in usage data
    const transformedModels = Object.entries(usage.models).reduce((acc, [model, stats]) => {
        acc[getFriendlyModelName(model)] = stats;
        return acc;
    }, {});

    // Transform model names in daily data
    const transformedDaily = usage.daily.map(day => ({
        ...day,
        models: Object.entries(day.models).reduce((acc, [model, stats]) => {
            acc[getFriendlyModelName(model)] = stats;
            return acc;
        }, {})
    }));

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f4f4f4; }
                .total { font-weight: bold; }
                .header { margin-bottom: 30px; }
                .footer { margin-top: 30px; font-size: 0.9em; color: #666; }
                .section { margin-bottom: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Pendium Health - Monthly Usage Bill</h2>
                    <p>Customer: ${customer.customer_name}</p>
                    <p>Month: ${monthString}</p>
                    <p>Email: ${customer.customer_email}</p>
                </div>

                <div class="section">
                    <h3>Monthly Summary</h3>
                    <table>
                        <tr>
                            <th>Description</th>
                            <th>Amount</th>
                        </tr>
                        <tr>
                            <td>Base Monthly Cost</td>
                            <td>$${rateLimitUsage.baseCost.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>API Calls (${usage.total_calls} calls)</td>
                            <td>${usage.total_calls <= rateLimitUsage.limit ? 'Included in base cost' : 
                                `${rateLimitUsage.overageCount} calls over limit`}</td>
                        </tr>
                        ${rateLimitUsage.overageCount > 0 ? `
                        <tr>
                            <td>Overage Charges (${rateLimitUsage.overageCount} calls @ $${customer.rate_limit.overage_charge_per_use}/call)</td>
                            <td>$${rateLimitUsage.overageCost.toFixed(2)}</td>
                        </tr>` : ''}
                        <tr class="total">
                            <td>Total</td>
                            <td>$${rateLimitUsage.totalCost.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>

                <div class="section">
                    <h3>Usage by Model</h3>
                    <table>
                        <tr>
                            <th>Model</th>
                            <th>API Calls</th>
                            <th>% of Total</th>
                            <th>Input Tokens</th>
                            <th>Output Tokens</th>
                        </tr>
                        ${Object.entries(transformedModels).map(([model, stats]) => `
                        <tr>
                            <td>${model}</td>
                            <td>${stats.calls}</td>
                            <td>${((stats.calls / usage.total_calls) * 100).toFixed(2)}%</td>
                            <td>${stats.input_tokens}</td>
                            <td>${stats.output_tokens}</td>
                        </tr>
                        `).join('')}
                        <tr class="total">
                            <td>Total</td>
                            <td>${usage.total_calls}</td>
                            <td>100%</td>
                            <td>${Object.values(usage.models).reduce((sum, stats) => sum + stats.input_tokens, 0)}</td>
                            <td>${Object.values(usage.models).reduce((sum, stats) => sum + stats.output_tokens, 0)}</td>
                        </tr>
                    </table>
                </div>

                <div class="section">
                    <h3>Daily Usage Breakdown</h3>
                    <table>
                        <tr>
                            <th>Date</th>
                            <th>Total Calls</th>
                            ${Object.keys(transformedModels).map(model => `
                                <th>${model}</th>
                            `).join('')}
                        </tr>
                        ${transformedDaily.map(day => `
                            <tr>
                                <td>${new Date(day.date).toLocaleDateString()}</td>
                                <td>${day.total_calls}</td>
                                ${Object.keys(transformedModels).map(model => `
                                    <td>${day.models[model]?.calls || 0}</td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </table>
                </div>

                <div class="footer">
                    <p>Thank you for using Pendium Health's services. For any questions about this bill, please contact us at hello@pendiumhealth.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

// Email sending function
const sendBillEmail = async (customer, billHtml, month) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "hello@pendiumhealth.com",
            pass: process.env.NODEMAILER_PASS,
        },
    });

    const monthDate = new Date(month);
    const monthString = monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    const mailOptions = {
        from: "Pendium Health - HippoAI <hello@pendiumhealth.ca>",
        to: 'stacy@pendiumhealth.com',
        subject: `Pendium Health - Usage Bill for ${monthString}`,
        html: billHtml
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

// Add new endpoint for generating and sending bills
exports.generateBill = async (req, res) => {
    try {
        const { customer_key, month } = req.query;
        
        if (!customer_key || !month) {
            return res.status(400).json({ error: "Customer key and month are required" });
        }

        // Get customer details
        const customer = await APICustomer.findOne({ api_key: customer_key });
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        // Get usage data
        const startDate = new Date(month);
        const endDate = new Date(month);
        endDate.setMonth(endDate.getMonth() + 1);
        
        const query = {
            api_key: customer_key,
            timestamp: { $gte: startDate, $lt: endDate }
        };

        // Get total calls
        const totalCalls = await UsageEntry.countDocuments(query);

        // Get model breakdown
        const modelStats = await UsageEntry.aggregate([
            { $match: query },
            { $group: {
                _id: "$model",
                calls: { $sum: 1 },
                input_tokens: { $sum: "$input_count" },
                output_tokens: { $sum: "$output_count" }
            }}
        ]);

        // Get daily breakdown
        const dailyStats = await UsageEntry.aggregate([
            { $match: query },
            { $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
                },
                total_calls: { $sum: 1 },
                models: {
                    $push: {
                        model: "$model",
                        input_tokens: "$input_count",
                        output_tokens: "$output_count"
                    }
                }
            }},
            { $sort: { "_id.date": 1 } }
        ]);

        // Transform daily stats
        const dailyUsage = dailyStats.map(day => {
            const modelBreakdown = day.models.reduce((acc, entry) => {
                const model = entry.model || "gpt-4-1106-preview";
                if (!acc[model]) {
                    acc[model] = {
                        calls: 0,
                        input_tokens: 0,
                        output_tokens: 0
                    };
                }
                acc[model].calls++;
                acc[model].input_tokens += entry.input_tokens;
                acc[model].output_tokens += entry.output_tokens;
                return acc;
            }, {});

            return {
                date: day._id.date,
                total_calls: day.total_calls,
                models: modelBreakdown
            };
        });

        const usage = {
            total_calls: totalCalls,
            models: modelStats.reduce((acc, stat) => {
                acc[stat._id || "gpt-4-1106-preview"] = {
                    calls: stat.calls,
                    input_tokens: stat.input_tokens,
                    output_tokens: stat.output_tokens
                };
                return acc;
            }, {}),
            daily: dailyUsage
        };

        // Calculate rate limit usage
        const monthlyLimit = customer.rate_limit.monthly_limit;
        const overageCount = Math.max(0, totalCalls - monthlyLimit);
        const baseCost = customer.rate_limit.base_cost_month;
        const overageCost = overageCount * customer.rate_limit.overage_charge_per_use;

        const rateLimitUsage = {
            used: totalCalls,
            limit: monthlyLimit,
            overageCount,
            overageCost,
            baseCost,
            totalCost: baseCost + overageCost
        };

        // Generate bill HTML
        const billHtml = generateBillHTML(customer, usage, rateLimitUsage, month);

        // Send email if requested
        let emailSent = false;
        if (req.query.send_email === 'true') {
            emailSent = await sendBillEmail(customer, billHtml, month);
        }

        res.status(200).json({
            html: billHtml,
            email_sent: emailSent,
            usage,
            rateLimitUsage
        });

    } catch (error) {
        console.error('Error generating bill:', error);
        res.status(500).json({ error: "Failed to generate bill" });
    }
};

exports.index = async (req, res) => {
    try {
        console.log('fetching usage entries');
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 50;
        const skip = (page - 1) * perPage;
        const customer_key = req.query.customer || "";
        const month = req.query.month || "";
        const query = {};

        // Get available months for the dropdown
        const months = await UsageEntry.aggregate([
            { $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } }
            }},
            { $sort: { "_id": -1 } }
        ]);

        // Apply month filter if specified
        if (month) {
            const startDate = new Date(month);
            const endDate = new Date(month);
            endDate.setMonth(endDate.getMonth() + 1);
            query.timestamp = { $gte: startDate, $lt: endDate };
        }

        // Get total usage entries for the month
        const totalUsageEntries = await UsageEntry.countDocuments(query);

        // Get all API customers
        const apiCustomers = await APICustomer.find({});

        // Initialize response data
        let responseData = {
            apiCustomers,
            months: months,
            chatLogs: [],
            usageEntries: [],
            totalUsagePercentageForSelectedCustomer: 0,
            usage: {
                total_calls: 0,
                models: {},
                daily: []
            }
        };

        // If customer is selected, calculate detailed metrics
        if (customer_key) {
            query.api_key = customer_key;
            
            // Get customer details
            const customer = await APICustomer.findOne({ api_key: customer_key });
            
            if (customer) {
                // Get unique models first
                const uniqueModels = await UsageEntry.distinct('model', query);
                
                // Get total calls and per-model breakdown
                const totalStats = await UsageEntry.aggregate([
                    { $match: query },
                    { $group: {
                        _id: null,
                        total_calls: { $sum: 1 },
                        models: {
                            $push: {
                                model: "$model",
                                input_tokens: "$input_count",
                                output_tokens: "$output_count"
                            }
                        }
                    }}
                ]);

                if (totalStats.length > 0) {
                    responseData.usage.total_calls = totalStats[0].total_calls;
                    
                    // Calculate per-model statistics
                    const modelStats = totalStats[0].models.reduce((acc, entry) => {
                        const model = entry.model || "gpt-4-1106-preview";
                        if (!acc[model]) {
                            acc[model] = {
                                calls: 0,
                                input_tokens: 0,
                                output_tokens: 0
                            };
                        }
                        acc[model].calls++;
                        acc[model].input_tokens += entry.input_tokens;
                        acc[model].output_tokens += entry.output_tokens;
                        return acc;
                    }, {});

                    responseData.usage.models = modelStats;
                }

                // Get daily breakdown
                const dailyStats = await UsageEntry.aggregate([
                    { $match: query },
                    { $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
                        },
                        total_calls: { $sum: 1 },
                        models: {
                            $push: {
                                model: "$model",
                                input_tokens: "$input_count",
                                output_tokens: "$output_count"
                            }
                        }
                    }},
                    { $sort: { "_id.date": 1 } }
                ]);

                // Transform daily stats into a more readable format
                responseData.usage.daily = dailyStats.map(day => {
                    const modelBreakdown = day.models.reduce((acc, entry) => {
                        const model = entry.model || "gpt-4-1106-preview";
                        if (!acc[model]) {
                            acc[model] = {
                                calls: 0,
                                input_tokens: 0,
                                output_tokens: 0
                            };
                        }
                        acc[model].calls++;
                        acc[model].input_tokens += entry.input_tokens;
                        acc[model].output_tokens += entry.output_tokens;
                        return acc;
                    }, {});

                    return {
                        date: day._id.date,
                        total_calls: day.total_calls,
                        models: modelBreakdown
                    };
                });

                // Get regular usage entries
                responseData.usageEntries = await UsageEntry.find(query).sort({ timestamp: -1 });

                // Calculate total usage percentage for selected customer
                const customerUsageCount = await UsageEntry.countDocuments(query);
                responseData.totalUsagePercentageForSelectedCustomer = totalUsageEntries > 0 
                    ? (customerUsageCount / totalUsageEntries) 
                    : 0;

                // Get chat logs for the selected customer
                responseData.chatLogs = await BackendChatLog.find(query)
                    .sort({ timestamp: -1 })
                    .skip(skip)
                    .limit(perPage);
            }
        }

        res.status(200).json(responseData);
    } catch (error) {
        console.log('error', error);
        res.status(400).json({ error: "Failed to get usage entries" });
    }
}
