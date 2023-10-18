const BetaUser = require("../models/BetaUser");
const ChatLog = require("../models/chatLog");
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
        
      if (dateRange && dateRangeValues.includes(dateRange)) {
        let dateLimit;
        switch (dateRange) {
          case 'last-week':
            dateLimit = moment().subtract(7, 'days').toDate();
            break;
          case 'last-month':
            dateLimit = moment().subtract(1, 'months').toDate();
            break;
          case 'last-year':
            dateLimit = moment().subtract(1, 'years').toDate();
            break;
          default:
            dateLimit = null;
        }
        if (dateLimit) {
          query.datetime = { $gte: dateLimit };
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
        query.date = dateFilter; // Add the status filter to the query object
        }
    
    const userFilter = req.query.user || "";

    if (userFilter) {
        query.email = userFilter; // Add the status filter to the query object
        }
    

    const userRatingFilter = req.query.userRatingFilter || "";
        if (userRatingFilter) {
        query.user_rating = { $exists: true };
        }


  const result = await ChatLog.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$date",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

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
        .sort({ datetime: -1 });
    
    const users = await ChatLog.distinct("email", query);

    const data = {
        chatLogs,
        totalCount,
        currentPage: page,
        dateCountObj,
        users,
    };

    res.json(data);
    }
    catch (err) {
      console.error(err);
      res.status(500).json(err);
    }
    }



  