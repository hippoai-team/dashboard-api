const ChatLog = require('../models/chatLog');
const FeatureInteraction = require('../models/FeatureInteraction');
const UserFeedback = require('../models/UserFeedback');
const User = require('../models/userModel');
const moment = require('moment-timezone');
const Stripe = require("stripe");

// Helper function to convert dates to EST
const toEST = (date) => moment(date).tz('America/New_York').format();

exports.index = async (req, res) => {
    try {
        const { kpi, startDate, endDate, bins } = req.query;
        let result;
        let customBins = bins ? bins.split(',').map(Number) : null;

        // Convert start and end dates to EST
        const estStartDate = toEST(startDate);
        const estEndDate = toEST(endDate);

        switch (kpi) {
            case 'averageDailyQueries':
                result = await calculateAverageDailyQueries(estStartDate, estEndDate);
                break;
            case 'dailyActiveUsers':
                result = await calculateDailyActiveUsers(estStartDate, estEndDate);
                break;
            case 'weeklyUserEngagement':
                result = await weeklyUserEngagement(estStartDate, estEndDate);
                break;
            case 'totalQueries':
                result = await calculateTotalQueries(estStartDate, estEndDate);
                break;
            case 'userTurnoverRateWeekly':
                result = await calculateUserTurnoverRateWeekly(estStartDate, estEndDate);
                break;
            case 'churnRate':
                result = await calculateChurnRate(estStartDate, estEndDate);
                break;
            case 'featureUseFrequencySaveSources':
                result = await calculateFeatureUseFrequencySaveSources(estStartDate, estEndDate);
                break;
            case 'featureUseFrequencyPrimaryLiteratureVsSource':
                result = await calculateFeatureUseFrequencyPrimaryLiteratureVsSource(estStartDate, estEndDate);
                break;
            case 'featureInteractionRateCalculator':
                result = await calculateFeatureInteractionCountForCalculator(estStartDate, estEndDate);
                break;
            case 'averageDailyQueriesDistribution':
                result = await calculateAverageDailyQueriesDistribution(estStartDate, estEndDate, customBins);
                break;
            case 'tokenUsageDistribution':
                result = await calculateTokenUsageDistribution(estStartDate, estEndDate, customBins);
                break;
            case 'newUserSignups':
                result = await calculateNewUserSignups(estStartDate, estEndDate);
                break;
            case 'featureInteractionsPerDay':
                result = await calculateFeatureInteractionsPerDay(estStartDate, estEndDate);
                break;
            case 'userRetentionMetrics':
                result = await calculateUserRetentionMetrics(estStartDate, estEndDate);
                break;
            case 'stripeMetrics':
                result = await calculateStripeMetrics(estStartDate, estEndDate);
                break;
            case 'caseSubmissionAnalytics':
                result = await calculateCaseSubmissionAnalytics(estStartDate, estEndDate);
                break;
            default:
                return res.status(400).json({ error: 'Invalid KPI specified' });
        }
        console.log('result', result);
        res.json(result);
    } catch (error) {
        console.error('Error in KPI calculation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update all the KPI calculation functions to use EST
async function calculateAverageDailyQueries(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { 
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate) 
                },
                role: 'user',
                chat_history: { $exists: true, $ne: null }
            }
        },
        {
            $group: {
                _id: { 
                    $dateToString: { 
                        format: "%Y-%m-%d", 
                        date: "$created_at",
                        timezone: "America/New_York"
                    } 
                },
                uniqueUsers: { $addToSet: "$email" },
                totalQueries: {
                    $sum: {
                        $cond: {
                            if: { $isArray: "$chat_history" },
                            then: { $size: "$chat_history" },
                            else: 0
                        }
                    }
                }
            }
        },
        {
            $project: {
                date: "$_id",
                uniqueUsers: { $size: "$uniqueUsers" },
                totalQueries: 1,
                averageQueries: {
                    $cond: [
                        { $eq: [{ $size: "$uniqueUsers" }, 0] },
                        0,
                        { $divide: ["$totalQueries", { $size: "$uniqueUsers" }] }
                    ]
                }
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);
    return { kpi: 'Average Daily Queries Per User', data: result };
}

async function calculateDailyActiveUsers(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role:'user'

            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "America/New_York" } },
                uniqueUsers: { $addToSet: "$email" }
            }
        },
        {
            $project: {
                date: "$_id",
                activeUsers: { $size: "$uniqueUsers" }
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);
    
    if (result.length === 0) {
        console.log('No data found for the given date range');
        return { kpi: 'Daily Active Users', data: [] };
    }
    
    console.log(`Found ${result.length} days of data`);
    return { kpi: 'Daily Active Users', data: result };
}


async function weeklyUserEngagement(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role: 'user'
            }
        },
        {
            $group: {
                _id: {
                    week: {
                        $floor: {
                            $divide: [
                                { $subtract: ["$created_at", new Date(startDate)] },
                                1000 * 60 * 60 * 24 * 7
                            ]
                        }
                    }
                },
                totalQueries: { $sum: { $size: "$chat_history" } },
                uniqueUsers: { $addToSet: "$email" }
            }
        },
        {
            $project: {
                week: "$_id.week",
                totalQueries: 1,
                uniqueUsers: { $size: "$uniqueUsers" },
                queriesPerUser: { 
                    $cond: [
                        { $eq: [{ $size: "$uniqueUsers" }, 0] },
                        0,
                        { $divide: ["$totalQueries", { $size: "$uniqueUsers" }] }
                    ]
                }
            }
        },
        {
            $sort: { "week": 1 }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);

    // Calculate week-over-week changes
    const weeklyEngagement = result.map((week, index) => {
        const prevWeek = index > 0 ? result[index - 1] : null;
        const changeInQueriesPerUser = prevWeek 
            ? week.queriesPerUser - prevWeek.queriesPerUser 
            : 0;
        const percentageChange = prevWeek && prevWeek.queriesPerUser !== 0
            ? ((week.queriesPerUser - prevWeek.queriesPerUser) / prevWeek.queriesPerUser) * 100
            : 0;

        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(weekStartDate.getDate() + week.week * 7);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);

        return {
            weekStart: weekStartDate.toISOString().split('T')[0],
            weekEnd: weekEndDate.toISOString().split('T')[0],
            queriesPerUser: week.queriesPerUser,
            changeInQueriesPerUser,
            percentageChange
        };
    });

    return { kpi: 'Weekly User Engagement (Change in Queries per User)', data: weeklyEngagement };
}

async function calculateTotalQueries(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role:'user'
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "America/New_York" } },
                totalQueries: { $sum: { $size: "$chat_history" } }
            }
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                totalQueries: 1
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);
    return { kpi: 'Total Queries per Day', data: result };
}

async function calculateUserTurnoverRateWeekly(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role: 'user'
            }
        },
        {
            $group: {
                _id: {
                    week: {
                        $floor: {
                            $divide: [
                                { $subtract: ["$created_at", new Date(startDate)] },
                                1000 * 60 * 60 * 24 * 7
                            ]
                        }
                    }
                },
                activeUsers: { $addToSet: "$email" }
            }
        },
        {
            $sort: { "_id.week": 1 }
        },
        {
            $project: {
                week: "$_id.week",
                activeUsersCount: { $size: "$activeUsers" }
            }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);

    const weeklyTurnover = result.map((week, index) => {
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(weekStartDate.getDate() + week.week * 7);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);

        if (index === 0) {
            return {
                weekStart: weekStartDate.toISOString().split('T')[0],
                weekEnd: weekEndDate.toISOString().split('T')[0],
                activeUsers: week.activeUsersCount,
                newUsers: week.activeUsersCount,
                churnedUsers: 0,
                changePercentage: 0,
                turnoverRate: 0
            };
        }

        const prevWeek = result[index - 1];
        const newUsers = Math.max(0, week.activeUsersCount - prevWeek.activeUsersCount);
        const churnedUsers = Math.max(0, prevWeek.activeUsersCount - week.activeUsersCount + newUsers);
        const changePercentage = ((week.activeUsersCount - prevWeek.activeUsersCount) / prevWeek.activeUsersCount) * 100;
        const turnoverRate = (churnedUsers / prevWeek.activeUsersCount) * 100;

        return {
            weekStart: weekStartDate.toISOString().split('T')[0],
            weekEnd: weekEndDate.toISOString().split('T')[0],
            activeUsers: week.activeUsersCount,
            newUsers,
            churnedUsers,
            changePercentage,
            turnoverRate
        };
    });

    return { kpi: 'Weekly User Turnover', data: weeklyTurnover };
}

async function calculateChurnRate(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role:'user'
            }
        },
        {
            $group: {
                _id: {
                    month: { $month: "$created_at" },
                    year: { $year: "$created_at" }
                },
                activeUsers: { $addToSet: "$email" }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1 }
        },
        {
            $group: {
                _id: null,
                months: {
                    $push: {
                        month: "$_id.month",
                        year: "$_id.year",
                        activeUsers: "$activeUsers"
                    }
                }
            }
        },
        {
            $project: {
                churnRates: {
                    $map: {
                        input: { $range: [1, { $size: "$months" }] },
                        as: "index",
                        in: {
                            month: { $arrayElemAt: ["$months.month", "$$index"] },
                            year: { $arrayElemAt: ["$months.year", "$$index"] },
                            churnRate: {
                                $let: {
                                    vars: {
                                        prevActiveUsers: { $arrayElemAt: ["$months.activeUsers", { $subtract: ["$$index", 1] }] },
                                        currentActiveUsers: { $arrayElemAt: ["$months.activeUsers", "$$index"] }
                                    },
                                    in: {
                                        $divide: [
                                            { $subtract: [
                                                { $size: { $setDifference: ["$$prevActiveUsers", "$$currentActiveUsers"] } },
                                                { $size: { $setDifference: ["$$currentActiveUsers", "$$prevActiveUsers"] } }
                                            ]},
                                            { $size: "$$prevActiveUsers" }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        {
            $unwind: "$churnRates"
        },
        {
            $match: {
                "churnRates.month": { $ne: null }
            }
        },
        {
            $sort: {
                "churnRates.year": 1,
                "churnRates.month": 1
            }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);
    return { kpi: 'Churn Rate', data: result.map(r => r.churnRates) };
}

async function calculateFeatureUseFrequencySaveSources(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                "sources.createdAt": { $gte: new Date(startDate), $lte: new Date(endDate) }
            }
        },
        {
            $unwind: "$sources"
        },
        {
            $match: {
                "sources.createdAt": { $gte: new Date(startDate), $lte: new Date(endDate) }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$sources.createdAt", timezone: "America/New_York" } },
                totalSourcesSaved: { $sum: 1 },
                uniqueUsers: { $addToSet: "$email" }
            }
        },
        {
            $project: {
                date: "$_id",
                totalSourcesSaved: 1,
                uniqueUsers: { $size: "$uniqueUsers" },
                averageSourcesSaved: {
                    $cond: [
                        { $eq: [{ $size: "$uniqueUsers" }, 0] },
                        0,
                        { $divide: ["$totalSourcesSaved", { $size: "$uniqueUsers" }] }
                    ]
                }
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    const result = await User.aggregate(pipeline);
    return { 
        kpi: 'Feature Use Frequency (Save Sources)', 
        data: result.map(day => ({
            date: day.date,
            totalSourcesSaved: day.totalSourcesSaved,
            uniqueUsers: day.uniqueUsers,
            averageSourcesSaved: parseFloat(day.averageSourcesSaved.toFixed(2))
        }))
    };
}

async function calculateFeatureUseFrequencyPrimaryLiteratureVsSource(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role:'user'
            }
        },
        {
            $lookup: {
                from: "feature_interactions",
                localField: "thread_uuid",
                foreignField: "thread_uuid",
                as: "interactions"
            }
        },
        {
            $project: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "America/New_York" } },
                hasRelevantInteraction: {
                    $cond: {
                        if: {
                            $gt: [
                                {
                                    $size: {
                                        $filter: {
                                            input: "$interactions",
                                            as: "interaction",
                                            cond: {
                                                $or: [
                                                    { $eq: ["$$interaction.interaction.interaction", "opened_source"] },
                                                    { $eq: ["$$interaction.interaction.interaction", "clicked_intext_link"] }
                                                ]
                                            }
                                        }
                                    }
                                },
                                0
                            ]
                        },
                        then: 1,
                        else: 0
                    }
                }
            }
        },
        {
            $group: {
                _id: "$date",
                totalChatLogs: { $sum: 1 },
                chatLogsWithInteraction: { $sum: "$hasRelevantInteraction" }
            }
        },
        {
            $project: {
                date: "$_id",
                totalChatLogs: 1,
                chatLogsWithInteraction: 1,
                percentageWithInteraction: {
                    $multiply: [
                        { $divide: ["$chatLogsWithInteraction", "$totalChatLogs"] },
                        100
                    ]
                }
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);
    return { 
        kpi: 'Feature Use Frequency (Primary Literature or Source)',
        data: result.map(day => ({
            _id: day._id,
            date: day.date,
            totalChatLogs: day.totalChatLogs,
            chatLogsWithInteraction: day.chatLogsWithInteraction,
            percentageWithInteraction: day.percentageWithInteraction
        }))
    };
}

async function calculateFeatureInteractionCountForCalculator(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
                "interaction.interaction": "calculator_submitted"
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "America/New_York" } },
                interactionCount: { $sum: 1 }
            }
        },
        {
            $project: {
                date: "$_id",
                interactionCount: 1
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    const result = await FeatureInteraction.aggregate(pipeline);
    return {
        kpi: 'Raw Feature Interaction Count (Calculator Submitted)',
        data: result.map(day => ({
            _id: day.date,
            date: day.date,
            interactionCount: day.interactionCount
        }))
    };
}

async function calculateAverageDailyQueriesDistribution(startDate, endDate, customBins) {
    const boundaries = customBins || [0, 1, 4, 10, 20, 50, 100, Infinity];
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role: 'user'
            }
        },
        {
            $group: {
                _id: "$email",
                totalQueries: { $sum: { $size: "$chat_history" } },
                uniqueDays: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "America/New_York" } } }
            }
        },
        {
            $project: {
                averageDailyQueries: {
                    $cond: [
                        { $eq: [{ $size: "$uniqueDays" }, 0] },
                        0,
                        { $divide: ["$totalQueries", { $size: "$uniqueDays" }] }
                    ]
                }
            }
        },
        {
            $bucket: {
                groupBy: "$averageDailyQueries",
                boundaries: boundaries,
                default: "Other",
                output: {
                    count: { $sum: 1 },
                    users: { $push: "$_id" }
                }
            }
        },
        {
            $project: {
                min: "$_id",
                max: {
                    $switch: {
                        branches: boundaries.slice(0, -1).map((boundary, index) => ({
                            case: { $eq: ["$_id", boundary] },
                            then: boundaries[index + 1]
                        })),
                        default: "Infinity"
                    }
                },
                count: 1,
                users: 1
            }
        },
        {
            $sort: { min: 1 }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);
    return { kpi: 'Average Daily Queries Distribution', data: result };
}



async function calculateTokenUsageDistribution(startDate, endDate, customBins) {
    const defaultBins = [0, 100, 500, 1000, 2000, 5000, 10000, 20000, 30000, 50000, 60000, Infinity];
    const boundaries = customBins || defaultBins;
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role: 'user'
            }
        },
        {
            $unwind: "$chat_history"
        },
        {
            $project: {
                tokensIn: "$chat_history.tokenSummary.in",
                tokensOut: "$chat_history.tokenSummary.out",
                totalTokens: { $add: ["$chat_history.tokenSummary.in", "$chat_history.tokenSummary.out"] }
            }
        },
        {
            $facet: {
                tokensInDistribution: [
                    {
                        $bucket: {
                            groupBy: "$tokensIn",
                            boundaries: boundaries,
                            default: "Other",
                            output: {
                                count: { $sum: 1 }
                            }
                        }
                    }
                ],
                tokensOutDistribution: [
                    {
                        $bucket: {
                            groupBy: "$tokensOut",
                            boundaries: boundaries,
                            default: "Other",
                            output: {
                                count: { $sum: 1 }
                            }
                        }
                    }
                ],
                totalTokensDistribution: [
                    {
                        $bucket: {
                            groupBy: "$totalTokens",
                            boundaries: boundaries,
                            default: "Other",
                            output: {
                                count: { $sum: 1 }
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                tokensInDistribution: {
                    $map: {
                        input: "$tokensInDistribution",
                        as: "bin",
                        in: {
                            min: "$$bin._id",
                            max: {
                                $let: {
                                    vars: { index: { $indexOfArray: [boundaries, "$$bin._id"] } },
                                    in: { $arrayElemAt: [boundaries, { $add: ["$$index", 1] }] }
                                }
                            },
                            count: "$$bin.count"
                        }
                    }
                },
                tokensOutDistribution: {
                    $map: {
                        input: "$tokensOutDistribution",
                        as: "bin",
                        in: {
                            min: "$$bin._id",
                            max: {
                                $let: {
                                    vars: { index: { $indexOfArray: [boundaries, "$$bin._id"] } },
                                    in: { $arrayElemAt: [boundaries, { $add: ["$$index", 1] }] }
                                }
                            },
                            count: "$$bin.count"
                        }
                    }
                },
                totalTokensDistribution: {
                    $map: {
                        input: "$totalTokensDistribution",
                        as: "bin",
                        in: {
                            min: "$$bin._id",
                            max: {
                                $let: {
                                    vars: { index: { $indexOfArray: [boundaries, "$$bin._id"] } },
                                    in: { $arrayElemAt: [boundaries, { $add: ["$$index", 1] }] }
                                }
                            },
                            count: "$$bin.count"
                        }
                    }
                }
            }
        }
    ];

    const result = await ChatLog.aggregate(pipeline);
    return { kpi: 'Token Usage Distribution', data: result[0] };
}

async function calculateUserConversionRate(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role:'user'
            }
        },
        {
            $lookup: {
                from: "chatlogs",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$user", "$$userId"] },
                                    { $gte: ["$datetime", new Date(startDate)] },
                                    { $lte: ["$datetime", new Date(endDate)] }
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$datetime", timezone: "America/New_York" } },
                            count: { $sum: 1 }
                        }
                    }
                ],
                as: "activity"
            }
        },
        {
            $project: {
                _id: 1,
                activityDays: { $size: "$activity" },
                activityGaps: {
                    $reduce: {
                        input: { $range: [1, { $size: "$activity" }] },
                        initialValue: { maxGap: 0, prevDate: { $arrayElemAt: ["$activity._id", 0] } },
                        in: {
                            maxGap: {
                                $max: [
                                    "$$value.maxGap",
                                    {
                                        $subtract: [
                                            { $dateFromString: { dateString: { $arrayElemAt: ["$activity._id", "$$this"] } } },
                                            { $dateFromString: { dateString: "$$value.prevDate" } }
                                        ]
                                    }
                                ]
                            },
                            prevDate: { $arrayElemAt: ["$activity._id", "$$this"] }
                        }
                    }
                }
            }
        },
        {
            $match: {
                activityDays: { $gte: 2 },
                "activityGaps.maxGap": { $lte: 1000 * 60 * 60 * 24 * 14 }  // 14 days in milliseconds
            }
        },
        {
            $count: "convertedUsers"
        },
        {
            $lookup: {
                from: "users",
                pipeline: [
                    {
                        $match: {
                            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
                        }
                    },
                    {
                        $count: "totalSignups"
                    }
                ],
                as: "totalSignups"
            }
        },
        {
            $project: {
                conversionRate: {
                    $multiply: [
                        {
                            $divide: [
                                "$convertedUsers",
                                { $arrayElemAt: ["$totalSignups.totalSignups", 0] }
                            ]
                        },
                        100
                    ]
                }
            }
        }
    ];

    const result = await User.aggregate(pipeline);
    return {
        kpi: 'User Conversion Rate',
        data: result.length > 0 ? result[0].conversionRate : 0
    };
}

async function calculateNewUserSignups(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                signup_date: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role: 'user'
            }
        },
        {
            $group: {
                _id: "$email",
                signupDate: { $min: "$signup_date" }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$signupDate", timezone: "America/New_York" } },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                count: 1
            }
        }
    ];

    const result = await User.aggregate(pipeline);
    return {
        kpi: 'New User Signups',
        data: result
    };
}

async function calculateFeatureInteractionsPerDay(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "America/New_York" } },
                    interaction: "$interaction.interaction"
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: "$_id.date",
                interactions: {
                    $push: {
                        interaction: "$_id.interaction",
                        count: "$count"
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                interactions: 1
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    const result = await FeatureInteraction.aggregate(pipeline);
    return { 
        kpi: 'Feature Interactions Per Day', 
        data: result.map(day => ({
            date: day.date,
            interactions: day.interactions.reduce((acc, curr) => {
                acc[curr.interaction] = curr.count;
                return acc;
            }, {})
        }))
    };
}

async function calculateUserRetentionMetrics(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                signup_date: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role: 'user'
            }
        },
        {
            $lookup: {
                from: "chat_logs_hippo",
                let: { userEmail: "$email" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$email", "$$userEmail"] },
                            role: 'user'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            firstActivity: { $min: "$created_at" },
                            lastActivity: { $max: "$created_at" },
                            totalDaysActive: {
                                $addToSet: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: "$created_at",
                                        timezone: "America/New_York"
                                    }
                                }
                            }
                        }
                    }
                ],
                as: "activity"
            }
        },
        {
            $project: {
                email: 1,
                signup_date: 1,
                firstActivity: { $arrayElemAt: ["$activity.firstActivity", 0] },
                lastActivity: { $arrayElemAt: ["$activity.lastActivity", 0] },
                totalDaysActive: {
                    $cond: {
                        if: { $gt: [{ $size: "$activity" }, 0] },
                        then: {
                            $size: {
                                $ifNull: [
                                    { $arrayElemAt: ["$activity.totalDaysActive", 0] },
                                    []
                                ]
                            }
                        },
                        else: 0
                    }
                },
                lifespan: {
                    $cond: {
                        if: {
                            $and: [
                                { $gt: [{ $size: "$activity" }, 0] },
                                { $ne: [{ $arrayElemAt: ["$activity.firstActivity", 0] }, null] },
                                { $ne: [{ $arrayElemAt: ["$activity.lastActivity", 0] }, null] }
                            ]
                        },
                        then: {
                            $divide: [
                                {
                                    $subtract: [
                                        { $arrayElemAt: ["$activity.lastActivity", 0] },
                                        { $arrayElemAt: ["$activity.firstActivity", 0] }
                                    ]
                                },
                                1000 * 60 * 60 * 24 // Convert to days
                            ]
                        },
                        else: 0
                    }
                },
                daysToChurn: {
                    $cond: {
                        if: {
                            $and: [
                                { $gt: [{ $size: "$activity" }, 0] },
                                { $ne: [{ $arrayElemAt: ["$activity.lastActivity", 0] }, null] }
                            ]
                        },
                        then: {
                            $divide: [
                                {
                                    $subtract: [
                                        { $arrayElemAt: ["$activity.lastActivity", 0] },
                                        "$signup_date"
                                    ]
                                },
                                1000 * 60 * 60 * 24 // Convert to days
                            ]
                        },
                        else: 0
                    }
                },
                isChurned: {
                    $cond: {
                        if: { $gt: [{ $size: "$activity" }, 0] },
                        then: {
                            $lt: [
                                { $arrayElemAt: ["$activity.lastActivity", 0] },
                                { $subtract: [new Date(), 1000 * 60 * 60 * 24 * 30] }
                            ]
                        },
                        else: true
                    }
                }
            }
        },
        {
            $facet: {
                lifespanDistribution: [
                    {
                        $bucket: {
                            groupBy: "$lifespan",
                            boundaries: [0, 1, 7, 30, 90, 180, 365],
                            default: "365+",
                            output: {
                                count: { $sum: 1 },
                                users: {
                                    $push: {
                                        email: "$email",
                                        signupDate: "$signup_date",
                                        lastActive: "$lastActivity",
                                        daysActive: "$totalDaysActive"
                                    }
                                }
                            }
                        }
                    }
                ],
                daysToChurnDistribution: [
                    {
                        $match: { isChurned: true }
                    },
                    {
                        $bucket: {
                            groupBy: "$daysToChurn",
                            boundaries: [0, 1, 7, 30, 60, 90],
                            default: "30+",
                            output: {
                                count: { $sum: 1 },
                                users: {
                                    $push: {
                                        email: "$email",
                                        signupDate: "$signup_date",
                                        lastActive: "$lastActivity",
                                        daysActive: "$totalDaysActive"
                                    }
                                }
                            }
                        }
                    }
                ],
                retentionCohorts: [
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: "%Y-%m",
                                    date: "$signup_date",
                                    timezone: "America/New_York"
                                }
                            },
                            totalUsers: { $sum: 1 },
                            activeUsers: {
                                $sum: { $cond: [{ $eq: ["$isChurned", false] }, 1, 0] }
                            },
                            avgDaysActive: { $avg: "$totalDaysActive" }
                        }
                    },
                    {
                        $project: {
                            cohort: "$_id",
                            totalUsers: 1,
                            activeUsers: 1,
                            retentionRate: {
                                $multiply: [
                                    { $divide: ["$activeUsers", "$totalUsers"] },
                                    100
                                ]
                            },
                            avgDaysActive: { $round: ["$avgDaysActive", 1] }
                        }
                    },
                    {
                        $sort: { cohort: 1 }
                    }
                ],
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalUsers: { $sum: 1 },
                            activeUsers: {
                                $sum: { $cond: [{ $eq: ["$isChurned", false] }, 1, 0] }
                            },
                            avgLifespan: { $avg: "$lifespan" },
                            avgDaysActive: { $avg: "$totalDaysActive" },
                            medianDaysToChurn: { $avg: "$daysToChurn" }
                        }
                    }
                ]
            }
        }
    ];

    const result = await User.aggregate(pipeline);
    return {
        kpi: 'User Retention Metrics',
        data: {
            lifespanDistribution: result[0].lifespanDistribution,
            daysToChurnDistribution: result[0].daysToChurnDistribution,
            retentionCohorts: result[0].retentionCohorts,
            summary: result[0].summary[0]
        }
    };
}

async function calculateStripeMetrics(startDate, endDate) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    try {
        // Get all customers using auto-pagination
        let allCustomers = [];
        for await (const customer of stripe.customers.list({
            created: {
                gte: Math.floor(new Date(startDate).getTime() / 1000),
                lte: Math.floor(new Date(endDate).getTime() / 1000)
            }
        })) {
            allCustomers.push(customer);
        }
        console.log('number of customers', allCustomers.length);

        // Get all subscriptions using auto-pagination
        let allSubscriptions = [];
        for await (const subscription of stripe.subscriptions.list({
            created: {
                gte: Math.floor(new Date(startDate).getTime() / 1000),
                lte: Math.floor(new Date(endDate).getTime() / 1000),
                expand: ['data.customer']
            }
        })) {
            allSubscriptions.push(subscription);
        }

        // Initialize metrics
        const metrics = {
            totalCustomers: allCustomers.length,
            proSubscriptions: {
                active: 0,
                trial: 0,
                cancelled: 0
            },
            basicSubscriptions: {
                active: 0,
                trial: 0,
                cancelled: 0
            },
            noSubscription: 0,
            conversionRate: 0
        };

        // Process subscriptions
        allSubscriptions.forEach(sub => {
            const isPro = sub.items.data.some(item => 
                item.price.product.includes('pro') || item.price.product.includes('Pro'));
            
            if (isPro) {
                if (sub.status === 'active' && !sub.cancel_at) {
                    metrics.proSubscriptions.active++;
                } else if (sub.status === 'trialing') {
                    metrics.proSubscriptions.trial++;
                } else if (sub.status === 'canceled' || sub.cancel_at) {
                    metrics.proSubscriptions.cancelled++;
                }
            } else {
                if (sub.status === 'active' && !sub.cancel_at) {
                    metrics.basicSubscriptions.active++;
                } else if (sub.status === 'trialing') {
                    metrics.basicSubscriptions.trial++;
                } else if (sub.status === 'canceled' || sub.cancel_at) {
                    metrics.basicSubscriptions.cancelled++;
                }
            }
        });

        // Calculate customers without subscriptions
        metrics.noSubscription = metrics.totalCustomers - 
            (metrics.proSubscriptions.active + metrics.proSubscriptions.trial +
             metrics.basicSubscriptions.active + metrics.basicSubscriptions.trial);

        // Calculate conversion rates
        const totalPaidSubscriptions = metrics.proSubscriptions.active + metrics.basicSubscriptions.active;
        metrics.conversionRate = (totalPaidSubscriptions / metrics.totalCustomers) * 100;

        // Calculate trial conversion rate
        const totalTrialEnded = metrics.proSubscriptions.cancelled + metrics.basicSubscriptions.cancelled;
        const totalConverted = metrics.proSubscriptions.active + metrics.basicSubscriptions.active;
        metrics.trialConversionRate = totalTrialEnded > 0 ? 
            (totalConverted / (totalTrialEnded + totalConverted)) * 100 : 0;

        return { kpi: 'Stripe Metrics', data: metrics };
    } catch (error) {
        console.error('Error calculating Stripe metrics:', error);
        throw error;
    }
}

async function calculateCaseSubmissionAnalytics(startDate, endDate) {
    // Pipeline for case submissions from feature_interactions collection
    const submissionsPipeline = [
        {
            $match: {
                timestamp: { 
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate) 
                },
                'interaction.interaction': 'submitted_case'
            }
        },
        {
            $group: {
                _id: { 
                    date: { 
                        $dateToString: { 
                            format: "%Y-%m-%d", 
                            date: "$timestamp",
                            timezone: "America/New_York"
                        }
                    },
                    user: "$email"
                },
                submissionCount: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: "$_id.date",
                uniqueUsers: { $addToSet: "$_id.user" },
                totalSubmissions: { $sum: "$submissionCount" }
            }
        },
        {
            $project: {
                date: "$_id",
                uniqueUsers: { $size: "$uniqueUsers" },
                totalSubmissions: 1,
                submissionsPerUser: {
                    $cond: [
                        { $eq: [{ $size: "$uniqueUsers" }, 0] },
                        0,
                        { $divide: ["$totalSubmissions", { $size: "$uniqueUsers" }] }
                    ]
                }
            }
        },
        {
            $sort: { date: 1 }
        }
    ];

    // Pipeline for study analytics from users collection
    const studyAnalyticsPipeline = [
        {
            $match: {
                user_attempted_cases: { $exists: true, $ne: {} }
            }
        },
        {
            $project: {
                email: 1,
                totalCases: { $size: { $objectToArray: "$user_attempted_cases" } },
                caseScores: {
                    $map: {
                        input: { $objectToArray: "$user_attempted_cases" },
                        as: "case",
                        in: "$$case.v.case_evaluation.score_percentage"
                    }
                },
                topics: {
                    $map: {
                        input: { $objectToArray: "$user_attempted_cases" },
                        as: "case",
                        in: "$$case.v.topic"
                    }
                }
            }
        },
        {
            $unwind: "$topics"
        },
        {
            $group: {
                _id: "$email",
                email: { $first: "$email" },
                totalCases: { $first: "$totalCases" },
                caseScores: { $first: "$caseScores" },
                topics: { $addToSet: "$topics" }
            }
        },
        {
            $project: {
                _id: 0,
                email: 1,
                totalCases: 1,
                averageScore: { $avg: "$caseScores" },
                topics: 1
            }
        },
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                averageCasesPerUser: { $avg: "$totalCases" },
                averageScore: { $avg: "$averageScore" },
                userScores: {
                    $push: {
                        email: "$email",
                        totalCases: "$totalCases",
                        averageScore: "$averageScore",
                        topics: "$topics"
                    }
                }
            }
        }
    ];

    const [submissionsResult, studyAnalytics] = await Promise.all([
        FeatureInteraction.aggregate(submissionsPipeline),
        User.aggregate(studyAnalyticsPipeline)
    ]);

    // Add daily submissions per user
    const userDailySubmissions = await FeatureInteraction.aggregate([
        {
            $match: {
                timestamp: { 
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate) 
                },
                'interaction.interaction': 'submitted_case'
            }
        },
        {
            $group: {
                _id: { 
                    date: { 
                        $dateToString: { 
                            format: "%Y-%m-%d", 
                            date: "$timestamp",
                            timezone: "America/New_York"
                        }
                    },
                    email: "$email"
                },
                submissions: {
                    $push: {
                        caseId: "$interaction.case_id",
                        topic: "$interaction.case_topic",
                        score: "$interaction.score_percentage"
                    }
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { "_id.date": 1 }
        },
        {
            $group: {
                _id: "$_id.email",
                dailySubmissions: {
                    $push: {
                        date: "$_id.date",
                        submissions: "$submissions",
                        count: "$count"
                    }
                }
            }
        }
    ]);

    return { 
        kpi: 'Case Submission Analytics', 
        data: {
            dailySubmissions: submissionsResult.sort((a, b) => new Date(a.date) - new Date(b.date)),
            studyAnalytics: studyAnalytics[0] || {
                totalUsers: 0,
                averageCasesPerUser: 0,
                averageScore: 0,
                userScores: []
            },
            userDailySubmissions: userDailySubmissions.reduce((acc, curr) => {
                acc[curr._id] = curr.dailySubmissions;
                return acc;
            }, {})
        }
    };
}

