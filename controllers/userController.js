const User = require('../models/userModel');
const ChatLog = require('../models/chatLog');
const BetaUser = require('../models/BetaUser');
const moment = require('moment');
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.index = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 10;
        const skip = (page - 1) * perPage;
    
        let query = {}

        const search = req.query.search || "";
        if (search) {
            const regexSearch = { $regex: search, $options: "i" };
            query.$or = [
                { email: regexSearch },
                { status: regexSearch },
                { name: regexSearch },
            ];
        }

        const totalUsers = await User.countDocuments(query);

        const users = await User.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'chat_logs_hippo',
                    localField: 'email',
                    foreignField: 'email',
                    as: 'chatLogs'
                }
            },
            {
                $project: {
                    email: 1,
                    name: 1,
                    profession: 1,
                    signup_date: 1,
                    stripeCustomerId: 1,
                    threadCount: { 
                        $size: { 
                            $ifNull: [
                                { $setUnion: "$chatLogs.thread_uuid" },
                                []
                            ]
                        } 
                    },
                    sourcesCount: { 
                        $size: { 
                            $ifNull: ["$sources", []]
                        } 
                    }
                }
            },
            { $sort: { signup_date: -1 } },
            { $skip: skip },
            { $limit: perPage }
        ]);

        // Fetch subscription information for users with a Stripe customer ID
        const usersWithSubscriptions = await Promise.all(users.map(async (user) => {
            if (user.stripeCustomerId) {
                try {
                    const subscriptions = await stripe.subscriptions.list({
                        customer: user.stripeCustomerId,
                        limit: 1
                    });

                    if (subscriptions.data.length > 0) {
                        const subscription = subscriptions.data[0];
                        const product = await stripe.products.retrieve(subscription.plan.product);
                        user.activeSubscriptionName = product.name;
                        user.activeSubscriptionStatus = subscription.status;
                    } else {
                        user.activeSubscriptionName = null;
                        user.activeSubscriptionStatus = null;
                    }
                } catch (error) {
                    console.error(`Error fetching subscription for user ${user.email}:`, error);
                    user.activeSubscriptionName = 'Error fetching subscription';
                    user.activeSubscriptionStatus = 'Error fetching subscription';
                }
            } else {
                user.activeSubscriptionName = null;
                user.activeSubscriptionStatus = null;
            }
            return user;
        }));

        const data = {
            users: usersWithSubscriptions,
            totalUsers,
        };
        res.status(200).json(data);

    } catch (error) {
        console.error('Error in index function:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.show = async (req, res) => {
    try {
        const user = await User.findById(req.params.id, 'name email status role');
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    }
exports.delete = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMultiple = async (req, res) => {
  try {
    const { ids } = req.body;
    await User.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: 'Users deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Function to calculate churn rate
async function calculateChurn(activityTimeRange, User, Chat, Beta, userCohort) {
    console.log('userCohort', userCohort)
    const cohortFilter = ['all', 'beta'].includes(userCohort) ? {} : { cohort: userCohort };
    const betaUsers = await Beta.find(cohortFilter).distinct('email');

    // Get users who signed up within the cohort 
    const usersInRange = await User.find({ 
      status: 'active',
      email: { $in: betaUsers }
    }).distinct('email');
    // Get users from usersInRange who have not chatted within the activity date range
    const { startDate, endDate } = setDateRange(activityTimeRange);
    const inactiveUsers = await User.find({
      email: { $in: usersInRange, $nin: await Chat.distinct('email', { datetime: { $gte: startDate, $lte: endDate } }) },
      status: 'active'
    }).distinct('email');
    //find days since last active for inactive users
    const lastActiveDates = await Chat.aggregate([
      { $match: { email: { $in: inactiveUsers } } },
      { $group: { _id: "$email", lastActiveDate: { $max: "$datetime" } } }
    ]).allowDiskUse(true);
    const inactiveUsersWithLastActiveDate = inactiveUsers.map(user => {
      const lastActiveDate = lastActiveDates.find(lastActiveDate => lastActiveDate._id === user);
      return {
        email: user,
        //calculate number of days since last active
        daysSinceLastActive: lastActiveDate ? Math.round((endDate - lastActiveDate.lastActiveDate) / (1000 * 60 * 60 * 24)) : null
      };
    });

    const numInactiveUsers = inactiveUsers.length;
    const churnRate = (numInactiveUsers / usersInRange.length) * 100;
    // Calculate churn rate per week
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeks = (endDate - startDate) / msPerWeek;
    const churnPerWeek = churnRate / weeks;
    return {
      totalChurnRate: churnRate.toFixed(2) + '%',
      churnPerWeek: churnPerWeek.toFixed(2) + '%',
      churnDescription: `${usersInRange.length} beta users from beta list signed from cohort ${userCohort}. Between  ${startDate.toDateString()} and ${endDate.toDateString()}, ${inactiveUsers.length} users have not chatted in this time period. This is a churn rate of ${churnRate.toFixed(2)}% or ${churnPerWeek.toFixed(2)}% per week.`,
      inactiveUsers: inactiveUsersWithLastActiveDate
    };
  }
  
  const setDateRange = (range) => {
    const endDate = new Date();
    let startDate = new Date();
    switch (range) {
      case 'last_month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'last_week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last_year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all_time':
        startDate = new Date(0);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }
    return { startDate, endDate };
  };
 
  async function calculateUserTurnoverRate(userCohort, BetaList, Chat) {
    const queriesByUserAndWeek = {};
    const cohortFilter = ['all', 'beta'].includes(userCohort) ? {} : { cohort: userCohort };
    // Fetch users in the specified cohort
    const cohortUsers = await BetaList.find(cohortFilter).distinct('email');
  
    // Get chat logs for users in the cohort
    const chatLogs = await Chat.find({ email: { $in: cohortUsers } }).sort({ datetime: 1 }).allowDiskUse(true);
  
    chatLogs.forEach(chat => {
      const week = getWeekNumber(chat.datetime);
      const email = chat.email;
      if (!queriesByUserAndWeek[week]) {
        queriesByUserAndWeek[week] = {};
      }
      if (!queriesByUserAndWeek[week][email]) {
        queriesByUserAndWeek[week][email] = 0;
      }
      queriesByUserAndWeek[week][email]++;
    });

  
    // Calculate week-over-week changes for each user
    const weekOverWeekChanges = {};
    let prevWeek;
    for (const [week, queriesByUser] of Object.entries(queriesByUserAndWeek)) {
      if (prevWeek) {
        weekOverWeekChanges[week] = {};
        for (const [email, queryCount] of Object.entries(queriesByUser)) {
          const prevQueryCount = queriesByUserAndWeek[prevWeek][email] || 0;
          weekOverWeekChanges[week][email] = queryCount - prevQueryCount;
        }
      }
      prevWeek = week;
    }
  
    return {
      queriesByUserAndWeek,
      weekOverWeekChanges,
      weeklyTurnOverRateDescription: `The graph below shows the number of queries per beta user in beta list per week for cohort ${userCohort}. The week over week changes are shown if the user or cohort has been active for more than one week.`
    };
  }

// Helper function to get week number
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

function calculateWeekOverWeekChanges(queriesByUserAndWeek){
const weeks = Object.keys(queriesByUserAndWeek);
const uniqueUsers = [...new Set(weeks.flatMap(week => Object.keys(queriesByUserAndWeek[week])))];

const weekOverWeekChange = {};

weeks.forEach((week, index) => {
  if (index === 0) return; // Skip the first week
  
  const prevWeek = weeks[index - 1];
  weekOverWeekChange[week] = {};

  uniqueUsers.forEach(user => {
    const currentWeekCount = queriesByUserAndWeek[week]?.[user] || 0;
    const prevWeekCount = queriesByUserAndWeek[prevWeek]?.[user] || 0;
    weekOverWeekChange[week][user] = currentWeekCount - prevWeekCount;
  });
});

return weekOverWeekChange;
}




