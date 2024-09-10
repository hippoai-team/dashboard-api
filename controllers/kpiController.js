const ChatLog = require('../models/chatLog');
const FeatureInteraction = require('../models/FeatureInteraction');
const UserFeedback = require('../models/UserFeedback');
const User = require('../models/userModel');

exports.index = async (req, res) => {
    try {
        const { kpi, startDate, endDate, bins } = req.query;
        let result;
        let customBins = bins ? bins.split(',').map(Number) : null;

        switch (kpi) {
            case 'averageDailyQueries':
                result = await calculateAverageDailyQueries(startDate, endDate);
                break;
            case 'dailyActiveUsers':
                result = await calculateDailyActiveUsers(startDate, endDate);
                break;
            case 'weeklyUserEngagement':
                result = await weeklyUserEngagement(startDate, endDate);
                break;
            case 'totalQueries':
                result = await calculateTotalQueries(startDate, endDate);
                break;
            case 'userTurnoverRateWeekly':
                result = await calculateUserTurnoverRateWeekly(startDate, endDate);
                break;
            case 'churnRate':
                result = await calculateChurnRate(startDate, endDate);
                break;
            case 'featureUseFrequencySaveSources':
                result = await calculateFeatureUseFrequencySaveSources(startDate, endDate);
                break;
            case 'featureUseFrequencyPrimaryLiteratureVsSource':
                result = await calculateFeatureUseFrequencyPrimaryLiteratureVsSource(startDate, endDate);
                break;
            case 'featureInteractionRateCalculator':
                result = await calculateFeatureInteractionCountForCalculator(startDate, endDate);
                break;
            case 'averageDailyQueriesDistribution':
                result = await calculateAverageDailyQueriesDistribution(startDate, endDate, customBins);
                break;
            case 'tokenUsageDistribution':
                result = await calculateTokenUsageDistribution(startDate, endDate, customBins);
                break;
            
            default:
                return res.status(400).json({ error: 'Invalid KPI specified' });
        }
        console.log('result',result)
        res.json(result);
    } catch (error) {
        console.error('Error in KPI calculation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

async function calculateAverageDailyQueries(startDate, endDate) {
    const pipeline = [
        {
            $match: {
                created_at: { $gte: new Date(startDate), $lte: new Date(endDate) },
                role: 'user'
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                uniqueUsers: { $addToSet: "$email" },
                totalQueries: { $sum: { $size: "$chat_history" } }
            }
        },
        {
            $project: {
                date: "$_id",
                uniqueUsers: { $size: "$uniqueUsers" },
                totalQueries: "$totalQueries",
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
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
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
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
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
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$sources.createdAt" } },
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
                date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
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
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
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
                uniqueDays: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } } }
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
    const defaultBins = [0, 1000, 5000, 10000, 50000, 100000, 500000, Infinity];
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
            $group: {
                _id: "$email",
                totalTokensIn: { $sum: "$chat_history.tokenSummary.in" },
                totalTokensOut: { $sum: "$chat_history.tokenSummary.out" }
            }
        },
        {
            $project: {
                totalTokens: { $add: ["$totalTokensIn", "$totalTokensOut"] }
            }
        },
        {
            $facet: {
                tokensInDistribution: [
                    {
                        $bucket: {
                            groupBy: "$totalTokensIn",
                            boundaries: boundaries,
                            default: "Other",
                            output: {
                                count: { $sum: 1 },
                                users: { $push: "$_id" }
                            }
                        }
                    }
                ],
                tokensOutDistribution: [
                    {
                        $bucket: {
                            groupBy: "$totalTokensOut",
                            boundaries: boundaries,
                            default: "Other",
                            output: {
                                count: { $sum: 1 },
                                users: { $push: "$_id" }
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
                                count: { $sum: 1 },
                                users: { $push: "$_id" }
                            }
                        }
                    }
                ]
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
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$datetime" } },
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
