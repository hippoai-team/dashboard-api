// controllers/BetaUserController.js

const BetaUser = require("../models/BetaUser");
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const User = require("../models/userModel");
exports.store = async (req, res) => {
  try {
    const betaUserData = req.body;
    // Validate fields

    if (!betaUserData.email || typeof betaUserData.email !== "string") {
      console.log('error, invalid email', betaUserData.subspecialty);
      return res.status(400).json({ error: "Invalid subspecialty" });
    }

    //if email already exists, return error
    if (await BetaUser.findOne({ email: betaUserData.email })) {
      console.log('error, email already exists', betaUserData.email);
      return res.status(400).json({ error: "Email already exists" });
    }

    // check if betauser already in user collection
    const user = await User.findOne({ email: betaUserData.email });
    if (user) {
      betaUserData.status = 'signed_up';
    } 
    // Create a new BetaUser instance and save it
    const betaUser = new BetaUser(betaUserData);
    betaUser.date_added = new Date();
    betaUser.usage = 0;
    betaUser.invite_sent = false;
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
      if (statusFilter === 'signed_up' || statusFilter === 'not_signed_up') {
        query.status = statusFilter; // Add the status filter to the query object

      } else if (statusFilter === 'used' || statusFilter === 'not_used') {
        const usageFilter = statusFilter === 'used' ? { $gt: 0 } : { $eq: 0 };
        query.usage = usageFilter;

      }
    }
    // Get distinct betaUser types

    // Get the number of betaUsers for each type of status based on search or filter

    const sourceFilter = req.query.source || "";
    if (sourceFilter) {
      query.source = sourceFilter; // Add the status filter to the query object
    }

    const statusCounts = {
      signed_up: 0,
      not_signed_up: 0,
      used_hippo: 0,
      never_used_hippo: 0
    };

    const cohortFilter = req.query.cohort || "";

    if (cohortFilter) {
      query.cohort = cohortFilter; // Add the status filter to the query object
    }


    const signedUpCount = await BetaUser.countDocuments({ ...query, status: 'signed_up' });
    const notSignedUpCount = await BetaUser.countDocuments({ ...query, status: 'not_signed_up' });
    const usedHippoCount = await BetaUser.countDocuments({ ...query, usage: { $gt: 0 } });
    const neverUsedHippoCount = await BetaUser.countDocuments({ ...query, usage: { $eq: 0 } });
    statusCounts.signed_up = signedUpCount;
    statusCounts.not_signed_up = notSignedUpCount;
    statusCounts.used_hippo = usedHippoCount;
    statusCounts.never_used_hippo = neverUsedHippoCount;

    // Find the total number of documents matching the query
    const totalBetaUsers = await BetaUser.countDocuments(query);
    // Query for betaUsers with pagination and sorting

  
    const betaUsers = await BetaUser.find(query)
      .sort({ date_added: -1 })
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
    const { userIds } = req.body;
    console.log('userIds', userIds)
//remove from db
  try {
    await BetaUser.deleteMany({ _id: { $in: userIds } });
    res.status(200).send('BetaUsers deleted successfully');

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
    await BetaUser.findByIdAndDelete(req.params.id);
    res.status(200).send('BetaUser deleted successfully');
  } catch (error) {
      res.status(500).send('Server error');
  }
};

exports.emailInviteToUser = async (req, res) => {
    email = req.params.email
    console.log('email', email)
    //if user.status = signed_up, return error
    const user = await BetaUser.findOne({ email: email });
    if (user.status === 'signed_up') {
        return res.status(200).send('User already signed up');
    }
    console.log('password',process.env.NODEMAILER_PASS)
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'hello@pendiumhealth.com',
              pass: process.env.NODEMAILER_PASS
            }
          });
        
        const mailOptions = {
        from: "Pendium Health - HippoAI <hello@pendiumhealth.com>",
        to: email,
        subject: `You're invited to sign up for HippoAI`,
        text: `
        Hi ${user.name},
        Thank you for your interest in HippoAI!

        You've been invited to sign up for HippoAI by Pendium Health. 
        To create your account, click the link below and sign up with this email address.
        https://hippo.pendium.health/sign-up
        `,
        };
    
        const result = await transporter.sendMail(mailOptions).then((result) => {
            console.log('Success: Email sent')
            //update user invite_sent field to true
        }).catch((error) => {
            console.log(error)
        });
        const update = await BetaUser.updateOne({ email: email }, { invite_sent: true });
        console.log('update', update)
        res.status(200).send('Email sent successfully');
    }
    catch (error) {
        console.log('error', error)
        res.status(500).send('Server error');
    }
}

exports.emailInviteToUsers = async (req, res) => {
    const { userIds } = req.body.data;
    //find emails of betaUsers using mongo
    const betaUsers = await BetaUser.find({ _id: { $in: userIds } });
    //remove users with status = signed_up
    betaUsers.filter(betaUser => betaUser.status !== 'signed_up');
    const emails = betaUsers.map(betaUser => betaUser.email);
    //send email to each email
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'hello@pendiumhealth.com',
          pass: process.env.NODEMAILER_PASS
        }
      });
    success_status_per_email = {};
    //send email to each email
    for (const email of emails) {
        const mailOptions = {
            from: "Pendium Health - HippoAI <hello@pendiumhealth.com>",
            to: email,
            subject: `You're invited to sign up for HippoAI`,
            text: `
            Thank you for your interest in HippoAI!
    
            You've been invited to sign up for HippoAI by Pendium Health. 
            To create your account, click the link below and sign up with this email address.
            https://hippo.pendium.health/sign-up
            `
        };
            

        const result = await transporter.sendMail(mailOptions).then((result) => {
            console.log('Success: Email sent to ' + email)
            success_status_per_email[email] = 'success';

        }
        ).catch((error) => {
            console.log(error)
            success_status_per_email[email] = 'error';
        });
        const update = await BetaUser.updateOne({ email: email }, { invite_sent: true });

    }

    res.status(200).send('Emails sent successfully', success_status_per_email);
}

exports.emailTemplateToUsers = async (req, res) => {
    const emailTemplatesJson = require('./utils/emailTemplates.json'); 
    const cohortDatesJson = require('./utils/cohortDates.json'); 
    const { users, emailType } = req.body.data;
    console.log('users', users)
    console.log('emailType', emailType)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'hello@hippoai.ca',
        pass: process.env.NODEMAILER_PASS
      }
    });
    success_status_per_email = {};

    for (const user of users) {
      const cohortDate = cohortDatesJson[user.cohort];
      const emailTemplate = emailTemplatesJson[emailType];
      const replacements = {
        name: user.name,
        start_date: cohortDate.start_date,
      };
      console.log('emailTemplate', emailTemplate.body)
      const emailBody = replacePlaceholders(emailTemplate.body, replacements);
      console.log('emailBody', emailBody)
      const mailOptions = {
          from: "HippoAI <hello@hippoai.ca>",
          to: user.email,
          subject: emailTemplate.subject,
          text: emailBody
      };
          

      const result = await transporter.sendMail(mailOptions).then((result) => {
          console.log('Success: Email sent to ' + user.email)
          success_status_per_email[user.email] = 'success';

      }
      ).catch((error) => {
          console.log(error)
          success_status_per_email[email] = 'error';
      });
    }
  }

  const replacePlaceholders = (str, replacements) => {
    return Object.keys(replacements).reduce((acc, placeholder) => {
      const regex = new RegExp(`{{${placeholder}}}`, 'g');
      return acc.replace(regex, replacements[placeholder]);
    }, str);
  };