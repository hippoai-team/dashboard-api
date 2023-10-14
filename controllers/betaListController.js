// controllers/BetaUserController.js

const BetaUser = require("../models/BetaUser");

exports.store = async (req, res) => {
  try {
    const betaUserData = req.body;
    console.log(betaUserData);
    // Validate fields

    if (!betaUserData.email || typeof betaUserData.email !== "string") {
      console.log('error, invalid email', betaUserData.subspecialty);
      return res.status(400).json({ error: "Invalid subspecialty" });
    }

    // Create a new BetaUser instance and save it
    const betaUser = new BetaUser(betaUserData);
    betaUser.date_added = new Date();
    await betaUser.save();

    res.status(201).json(betaUser);
  } catch (error) {
    if (error.name === "ValidationError") {
      console.log('error', error);
      return res.status(400).json({ error: error.message });
    }
    console.log('error', error);
    res.status(400).json({ error: "Failed to create betaUser" });
    
  }
};

exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the requested page or default to page 1
    const perPage = parseInt(req.query.perPage) || 10; // Get the requested number of items per page or default to 10

    // Calculate the skip value based on the requested page
    const skip = (page - 1) * perPage;

    let query = {};

    // Handle text search
    const search = req.query.search || "";
    if (search) {
      const regexSearch = { $regex: search, $options: "i" };

      const searchQueries = [
        { email: regexSearch },
        { status: regexSearch },
      ];

      if (!isNaN(search)) {
        searchQueries.push({ year: parseInt(search) });
      }

      query.$or = searchQueries;
    }


    const statusFilter = req.query.status || "";
    if (statusFilter) {
      query.status = statusFilter; // Add the status filter to the query object
    }

    // Get distinct betaUser types

    // Get the number of betaUsers for each type of status based on search or filter
    const statusTypes = [
      "signed_up",
      "logged_in",
      "used_hippo",
      "never_used_hippo",
      "never_signed_up",
    ];
    const statusCounts = {};

    for (const status of statusTypes) {
      statusCounts[status] = await BetaUser.countDocuments({ ...query, status });
    }

    // Find the total number of documents matching the query
    const totalBetaUsers = await BetaUser.countDocuments(query);

    // Query for betaUsers with pagination and sorting
    const betaUsers = await BetaUser.find(query)
      .sort({ date_modified: -1 })
      .skip(skip)
      .limit(perPage)
      .exec();

    const data = {
      betaUsers,
      totalBetaUsers,
      currentPage: page,
      statusCounts,
      totalPages: Math.ceil(totalBetaUsers / perPage),

    };

    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch betaUsers" });
  }
};

exports.deleteMultiple = async (req, res) => {
  const { betaUserIds } = req.body;


  try {
    const result = await BetaUser.updateMany(
      { _id: { $in: betaUserIds } },
      { $set: { isDeleted: true } }
    );

    if (result.nModified > 0) {
      res.status(200).json({ message: "Selected betaUsers soft deleted successfully."});
    } else {
      res.status(200).json({ message: "No betaUsers were modified. They might already be deleted or not found." });
    }

  } catch (error) {
    res.status(500).json({ error: `Failed to soft delete selected betaUsers: ${error.message}` });
  }
};


exports.show = async (req, res) => {
  try {
    const betaUser = await BetaUser.findById(req.params.id);
    if (!betaUser) {
      return res.status(404).json({ error: "BetaUser not found" });
    }
    res.json(betaUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch betaUser" });
  }
};

exports.update = async (req, res) => {
  console.log('update', req.body, req.params.id)
  try {
    const betaUser = await BetaUser.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!betaUser) {
      console.log('update error', error)
      return res.status(404).json({ error: "BetaUser not found" });
    }

    // Exclude date_added from the update
    betaUser.date_added = betaUser.date_added;

    // Update the date_modified field to the current date
    betaUser.date_modified = new Date();
    await betaUser.save();
    res.json(betaUser);
  } catch (error) {
    console.log('update error', error)
    res.status(500).json({ error: "Failed to update betaUser" });
  }
};

exports.destroy = async (req, res) => {
  try {
    await BetaUser.updateOne({ _id: req.params.id }, { isDeleted: true, status: 'remove' });
    res.status(200).send('BetaUser soft deleted successfully');
  } catch (error) {
      res.status(500).send('Server error');
  }
};
