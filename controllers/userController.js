const User = require('../models/userModel');
const ChatLog = require('../models/chatLog');
const BetaUser = require('../models/BetaUser');
const moment = require('moment');

exports.index = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the requested page or default to page 1
        const perPage = parseInt(req.query.perPage) || 10; // Get the requested number of items per page or default to 10
        // Calculate the skip value based on the requested page
        const skip = (page - 1) * perPage;
    
        // Initializing the search query 
        let query = {}

        const search = req.query.search || "";
    if (search) {
      const regexSearch = { $regex: search, $options: "i" };

      const searchQueries = [
        { email: regexSearch },
        { status: regexSearch },
        {name: regexSearch},
      ];
    
        query.$or = searchQueries;
    }

    

    const userGroupFilter = req.query.userGroupFilter || "";
    if (userGroupFilter) {
        if (userGroupFilter==='beta') {
          const activeBetaUsers = await BetaUser.find({});
          const activeBetaUsersEmails = activeBetaUsers.map(user => user.email);
          query.email = { $in: activeBetaUsersEmails };
        }
        //if in cohort A-D or None
        else if (['A','B','C','D','none'].includes(userGroupFilter)) {
  
          const activeBetaUsers = await BetaUser.find({cohort: userGroupFilter});
          const activeBetaUsersEmails = activeBetaUsers.map(user => user.email);
          query.email = { $in: activeBetaUsersEmails };
        }
        else if (userGroupFilter==='all') {
          //do nothing
        }
        else {
        }
          }
    const userFilter = req.query.userFilter || "";
          if (userFilter) {
              query.email = userFilter; // Add the user filter to the query object
              }
    
    const statusFilter = req.query.statusFilter || "";

    if (statusFilter) {
        query.status = statusFilter; // Add the status filter to the query object
        }
    
    const dateRangeFilter = req.query.dateRange || "last_week";
    const totalUsers = await User.countDocuments(query); // Count the total number of users
    const chatLogs = await ChatLog.find(query, {email: 1, datetime: { $dateToString: { format: "%Y-%m-%d", date: "$datetime" } } });
    const dailyActiveUsers = {};
    const dateRangeStart = req.query.dateRangeStart || "";
    const dateRangeEnd = req.query.dateRangeEnd || "";

    let dateRangeValues = ['last_week', 'last_month', 'last_year', 'all_time'];
    let startDate;
    let endDate;
    if (dateRangeStart && dateRangeEnd) {
      startDate = new Date(dateRangeStart);
      endDate = new Date(dateRangeEnd);

      endDate.setDate(endDate.getDate()); // Add one day to the end date
    } else if (dateRangeFilter && dateRangeValues.includes(dateRangeFilter)) {
      let dateRangeResult = setDateRange(dateRangeFilter);
      startDate = dateRangeResult.startDate;
      endDate = dateRangeResult.endDate;

    }

      chatLogs.forEach(log => {
        if (log.datetime >= startDate && log.datetime <= endDate) {
            if (!dailyActiveUsers[log.datetime]) {
                dailyActiveUsers[log.datetime] = new Set();
            }
            dailyActiveUsers[log.datetime].add(log.email);
        }
    });
    for (const datetime in dailyActiveUsers) {
        dailyActiveUsers[datetime] = {count: dailyActiveUsers[datetime].size, users: Array.from(dailyActiveUsers[datetime])};
    }
    const dailyActiveUsersDescription = `The number of active users per day for cohort:'${req.query.userGroupFilter}' in the ${dateRangeFilter}.`;
    const weeklyActiveUsers = {};

    
    for (const datetime in dailyActiveUsers) {
        const week = moment(datetime).startOf('week').format('YYYY-MM-DD');
        if (!weeklyActiveUsers[week]) {
            weeklyActiveUsers[week] = new Set();
        }
        dailyActiveUsers[datetime].users.forEach(user => {
            weeklyActiveUsers[week].add(user);
        });
    }
    for (const week in weeklyActiveUsers) {
        weeklyActiveUsers[week] = {count: weeklyActiveUsers[week].size, users: Array.from(weeklyActiveUsers[week])};
    }
    const weeklyActiveUsersDescription = `Active users per week and change for previous week for cohort:'${req.query.userGroupFilter}' in the ${dateRangeFilter}.`;

    //sum usage field from all users in query
    const totalUsage = await User.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: { $add: ["$usage", "$follow_up_usage"] } } } }
      ]).allowDiskUse(true);
    const totalUsageDescription = `The total usage for users in cohort:'${req.query.userGroupFilter}' in the query is ${totalUsage[0].total}.`;
    const totalUsageCount = totalUsage.length ? totalUsage[0].total : 0;

    const totalFeedback = await User.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$feedback_count" } } }
      ]).allowDiskUse(true);
    const totalFeedbackDescription = `The total feedback for users in cohort:'${req.query.userGroupFilter}' in the query is ${totalFeedback[0].total}.`;
    const totalFeedbackCount = totalFeedback.length ? totalFeedback[0].total : 0;


    //preset range filter

   const { totalChurnRate, churnPerWeek, churnDescription,inactiveUsers } = await calculateChurn(dateRangeFilter, User, ChatLog, BetaUser, req.query.userGroupFilter);
    const churnData = {
        totalChurnRate,
        churnPerWeek,
        inactiveUsers
    };
    const { queriesByUserAndWeek, weekOverWeekChanges, weeklyTurnOverRateDescription } = await calculateUserTurnoverRate(req.query.userGroupFilter, BetaUser, ChatLog);
    //send back data
 
    const savedSources = await User.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: { $cond: { if: { $isArray: "$sources" }, then: { $size: "$sources" }, else: 0 } } } } }
      ]).allowDiskUse(true);
    const totalSavedSources = savedSources.length ? savedSources[0].total : 0;
    const clickedSources = await User.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$sourceClickCount", 0] } } } }
      ]).allowDiskUse(true);
    const totalClickedSources = clickedSources.length ? clickedSources[0].total : 0;
    const followUpCount = await User.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$follow_up_usage", 0] } } } }

    ]).allowDiskUse(true);
    const totalFollowUpCount = followUpCount.length ? followUpCount[0].total : 0;

    const users = await User.aggregate([
      { $match: query },
      { $sort: { signup_date: -1 } }, // Sorting by signup_date before skipping and limiting
      { $skip: skip },
      { $limit: perPage },
      {
        $project: {
          email: 1,
          name: 1,
          status: 1,
          signup_date: 1,
          usage: 1,
          feedback_count: 1,
          clicked_sources: 1,
          sourceClickCount: 1,
          follow_up_usage: 1,
          nav_threads: 1,
          nav_saved_sources: 1,
          num_logins: 1,
          threadCount: { $size: "$threads" },
          sourcesCount: { $size: "$sources" },
          sources: 1 // Include sources array for further processing
        }
      },
      { $unwind: { path: "$sources", preserveNullAndEmptyArrays: true } },
      { $group: {
          _id: { userId: "$_id", sourceType: "$sources.source_type" },
          count: { $sum: 1 },
          // Add user document to each group to preserve threadCount and sourcesCount
          user_doc: { $first: "$$ROOT" }
      }},
      { $group: {
          _id: "$_id.userId",
          sourceCountType: {
            $push: {
              type: "$_id.sourceType",
              count: "$count"
            }
          },
          // Take the user document from the previous stage to preserve threadCount and sourcesCount
          user_doc: { $first: "$user_doc" }
      }},
      {
        $replaceRoot: { // Replace the root to clean up the structure
          newRoot: {
            $mergeObjects: ["$user_doc", { sourceCountType: "$sourceCountType" }]
          }
        }
      }
    ]).allowDiskUse(true);
    
    const savedSourceTypeCounts = {};
    users.forEach(user => {
      if (user.sourceCountType) {
        user.sourceCountType.forEach(sourceTypeCount => {
          if (sourceTypeCount && sourceTypeCount.type) {
            if (savedSourceTypeCounts[sourceTypeCount.type]) {
              savedSourceTypeCounts[sourceTypeCount.type] += sourceTypeCount.count;
            } else {
              savedSourceTypeCounts[sourceTypeCount.type] = sourceTypeCount.count;
            }
          }
        });
      }
    });
console.log(savedSourceTypeCounts);

      
    const descriptions = {
        dailyActiveUsersDescription,
        weeklyActiveUsersDescription,
        totalUsageDescription,
        totalFeedbackDescription,
        weeklyTurnOverRateDescription,
        churnDescription
    };

    const data = {
        users,
        totalUsers,
        totalUsageCount,
        totalFeedbackCount,
        dailyActiveUsers,
        weeklyActiveUsers,
        churnData,
        queriesByUserAndWeek,
        weekOverWeekChanges,
        descriptions,
        totalSavedSources,
        totalClickedSources,
        totalFollowUpCount,
        savedSourceTypeCounts

    };
    res.status(200).json(data);


}
catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
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




