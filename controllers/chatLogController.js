const ChatLog = require("../models/chatLog");
const BetaUser = require("../models/BetaUser");

const moment = require('moment');

exports.index = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1; // Get the requested page or default to page 1
      const perPage = parseInt(req.query.perPage) || 10; // Get the requested number of items per page or default to 10
    
      // Calculate the skip value based on the requested page
      const skip = (page - 1) * perPage;
  
      // Initializing the search query to status == 'remove' or 'removed'
      let query = {}
  
      // Handle text search
      const dateRange = req.query.dateRange || "";
      const dateRangeValues = ['all-time','last-week','last-month','last-year'];
        
      const dateRangeStart = req.query.dateRangeStart || "";
      const dateRangeEnd = req.query.dateRangeEnd || "";
      
      if (dateRangeStart && dateRangeEnd) {
        let startDate = new Date(dateRangeStart);
        let endDate = new Date(dateRangeEnd);
        endDate.setDate(endDate.getDate() + 1); // Add one day to the end date
        query.created_at = { $gte: startDate, $lte: endDate };
      } else if (dateRange && dateRangeValues.includes(dateRange)) {
        let dateLimit;
        switch (dateRange) {
          case 'last-week':
            dateLimit = moment().subtract(7, 'days').startOf('day').toDate();
            break;
          case 'last-month':
            dateLimit = moment().subtract(1, 'months').startOf('day').toDate();
            break;
          case 'last-year':
            dateLimit = moment().subtract(1, 'years').startOf('day').toDate();
            break;
          default:
            dateLimit = null;
        }
        if (dateLimit) {
          query.created_at = { $gte: dateLimit };
        }
      }
    
      const search = req.query.search || "";

    
      if (search) {
      const regexSearch = { $regex: search, $options: "i" };

      const searchQueries = [
        {email: regexSearch },
        {query: regexSearch},
        {response: regexSearch},
      ];

      if (!isNaN(search)) {
        searchQueries.push({ year: parseInt(search) });
      }

      query.$or = searchQueries;
    }

    const dateFilter = req.query.date || "";

    if (dateFilter) {
        let startOfDay = new Date(dateFilter);
        startOfDay.setHours(0,0,0,0);
        let endOfDay = new Date(dateFilter);
        endOfDay.setHours(23,59,59,999);
        query.created_at = { $gte: startOfDay, $lte: endOfDay };
    }
    
    const userFilter = req.query.user || "";

 
    
    const userGroupFilter = req.query.userGroup || "";

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

        if (userFilter) {
          query.email = userFilter; // Add the status filter to the query object
          }


    const totalUserRatingYes = await ChatLog.countDocuments({ user_rating: 'Yes', ...query });
    const totalUserRatingNo = await ChatLog.countDocuments({ user_rating: 'No', ...query });
    const totalFeedback = [totalUserRatingYes,totalUserRatingNo];
  
    const userRatingFilter = req.query.userRatingFilter || "";
        if (userRatingFilter == 'true') {
            query.user_rating = { $exists: true };
        } else if (typeof userRatingFilter === 'string' && userRatingFilter !== "") {
            query.user_rating = userRatingFilter;
        }

  const result = await ChatLog.aggregate([
    { $match: query },
    { $sort: { created_at: 1 } },
    {
      $group: {
        //_id: { $dateToString: { format: "%m/%d/%Y", date: "$datetime" } },
        _id: '$date',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  result.sort((a, b) => {
    return new Date(a._id) - new Date(b._id);
  });
  let accumulativeCount = 0;
  const dateCountObj = {};
  for (const item of result) {
    accumulativeCount += item.count;
    dateCountObj[item._id] = {
      count: item.count,
      accumulativeCount
    };
  }

  const totalCount = await ChatLog.countDocuments(query);
  //Query for chat logs with pagination and sorting
    const chatLogs = await ChatLog.find(query)
        .skip(skip)
        .limit(perPage)
        .sort({ created_at: -1 });
      
    
    const users = await ChatLog.distinct("email", query);

    const totalChats = await ChatLog.countDocuments({ ...query, datetime: { $gte: new Date('2023-11-16') } });
    const numChatsWithClickedSources = await ChatLog.aggregate([
        { $match: query },
        { $match: { datetime: { $gte: new Date('2023-11-16') } } },
        { $unwind: "$sources" },
        { $match: { "sources.clicked": true } },
        { $group: { _id: "$sources.source_type", count: { $sum: 1 } } }
    ]);
    const totalClicks = numChatsWithClickedSources.reduce((total, chat) => total + chat.count, 0);
    numChatsWithClickedSources.forEach(chat => {
        chat.totalClicksPercentage = (chat.count / totalClicks) * 100;
        chat.totalChatsPercentage = (chat.count / totalChats) * 100;
    });

    for (const chat of chatLogs) {
      for (const history of chat.chat_history) {
        console.log('history', history)
      }
    }
    const data = {
        chatLogs,
        totalCount,
        currentPage: page,
        dateCountObj,
        users,
        totalFeedback,
        numChatsWithClickedSources,

    };

    res.json(data);
    }
    catch (err) {
      console.error(err);
      res.status(500).json(err);
    }
    }



  