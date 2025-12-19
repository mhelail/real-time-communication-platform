const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const CallHistory = require('../models/CallHistory');
const logger = require('../utils/logger');
const constants = require('../utils/constants');

// Register
exports.register = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create new user
    const newUser = new User({
      username: username.toLowerCase(),
      password: hashedPassword
    });
    
    await newUser.save();
    
    logger.info(`New user registered: ${username}`);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      redirect: '/login.html'
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

// Login
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Find user (case-insensitive)
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: constants.JWT_EXPIRATION }
    );

    logger.info(`User logged in: ${username}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

// Create or find conversation
exports.createOrFindConversation = async (req, res, next) => {
  try {
    const { username } = req.body;
    const currentUsername = req.user.username;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Check if user exists
    const targetUser = await User.findOne({ username: username.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [currentUsername, username.toLowerCase()] },
      type: 'private'
    });

    if (!conversation) {
      conversation = new Conversation({
        type: 'private',
        participants: [currentUsername, username.toLowerCase()]
      });
      await conversation.save();
      logger.info(`New conversation created between ${currentUsername} and ${username}`);
    }

    res.status(200).json({
      success: true,
      conversationId: conversation._id
    });
  } catch (error) {
    logger.error('Error creating or finding conversation:', error);
    next(error);
  }
};

// Get user's conversations
exports.getConversations = async (req, res, next) => {
  try {
    const username = req.user.username;
    const conversations = await Conversation.find({ participants: username })
      .sort({ lastMessageTimestamp: -1 })
      .lean();

    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conversation) => {
        const lastMessage = await Message.findOne({ conversationId: conversation._id })
          .sort({ timestamp: -1 })
          .lean();

        if (conversation.type === 'group') {
          return {
            _id: conversation._id,
            conversationId: conversation._id,
            type: 'group',
            name: conversation.name,
            lastMessageTimestamp: conversation.lastMessageTimestamp,
            lastMessage: lastMessage ? lastMessage.content : null,
            lastMessageFrom: lastMessage ? lastMessage.from : null
          };
        } else {
          const participant = conversation.participants.find(part => part !== username);
          return {
            _id: conversation._id,
            conversationId: conversation._id,
            type: 'private',
            username: participant || 'Unnamed User',
            participants: conversation.participants,
            lastMessageTimestamp: conversation.lastMessageTimestamp,
            lastMessage: lastMessage ? lastMessage.content : null,
            lastMessageFrom: lastMessage ? lastMessage.from : null
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      conversations: conversationsWithLastMessage
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    next(error);
  }
};

// Search users and groups (only users the current user has chatted with)
exports.searchUsers = async (req, res, next) => {
  try {
    let searchTerm = req.query.username ? req.query.username.trim() : "";
    const currentUsername = req.user.username;

    if (!searchTerm || searchTerm.length < 1) {
      return res.status(200).json({
        success: true,
        users: [],
        groups: []
      });
    }

    // Prevent regex injection
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');

    // Find all private conversations where the current user is a participant
    const conversations = await Conversation.find({
      participants: currentUsername,
      type: 'private'
    }).select('participants');
    
    // Extract all unique usernames from conversations (excluding current user)
    const chatPartnerUsernames = new Set();
    conversations.forEach(conv => {
      conv.participants.forEach(participant => {
        if (participant !== currentUsername) {
          chatPartnerUsernames.add(participant);
        }
      });
    });

    // Filter usernames by search term, then get user details
    const filteredUsernames = Array.from(chatPartnerUsernames).filter(username => 
      regex.test(username)
    );

    // Search only among users who have chatted with current user
    const users = await User.find({
      username: { $in: filteredUsernames },
      _id: { $ne: req.user.id }
    }).select('username _id').limit(20);

    const userGroups = await Conversation.find({
      participants: { $in: [currentUsername] },
      type: 'group',
      name: { $regex: regex }
    }).select('name _id').limit(20);

    return res.status(200).json({
      success: true,
      users,
      groups: userGroups
    });
  } catch (error) {
    logger.error('Error searching users and groups:', error);
    next(error);
  }
};

// Get all users (only users the current user has chatted with)
exports.getAllUsers = async (req, res, next) => {
  try {
    const currentUsername = req.user.username;
    
    // Find all private conversations where the current user is a participant
    const conversations = await Conversation.find({
      participants: currentUsername,
      type: 'private'
    }).select('participants');
    
    // Extract all unique usernames from conversations (excluding current user)
    const chatPartnerUsernames = new Set();
    conversations.forEach(conv => {
      conv.participants.forEach(participant => {
        if (participant !== currentUsername) {
          chatPartnerUsernames.add(participant);
        }
      });
    });
    
    // Get user details for those who have chatted with current user
    const users = await User.find({
      username: { $in: Array.from(chatPartnerUsernames) }
    })
      .select('username _id isOnline lastSeen')
      .sort({ username: 1 });
    
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    next(error);
  }
};

// Get private messages
exports.getPrivateMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const username = req.user.username;

    // Verify user is part of conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.participants.includes(username)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }

    const messages = await Message.find({
      conversationId,
      deletedAt: { $exists: false }
    })
      .sort({ timestamp: 1 })
      .limit(100);

    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    logger.error('Error fetching private messages:', error);
    next(error);
  }
};

// Get group messages
exports.getGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const username = req.user.username;

    // Verify user is part of group
    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This is not a group conversation'
      });
    }

    if (!group.participants.includes(username)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this group'
      });
    }

    const messages = await Message.find({
      conversationId: groupId,
      deletedAt: { $exists: false }
    })
      .sort({ timestamp: 1 })
      .limit(100);

    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    logger.error('Error getting group messages:', error);
    next(error);
  }
};

// Send private message
exports.sendMessage = async (req, res, next) => {
  try {
    const { conversationId, content } = req.body;
    const from = req.user.username;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Verify user is part of conversation
    if (!conversation.participants.includes(from)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }

    const toUser = conversation.participants.find(participant => participant !== from);

    const newMessage = new Message({
      conversationId,
      from,
      to: toUser,
      content: content.trim()
    });

    await newMessage.save();

    // Update conversation's last message info
    conversation.lastMessageTimestamp = new Date();
    conversation.lastMessage = content.trim();
    conversation.lastMessageFrom = from;
    await conversation.save();

    res.status(201).json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    next(error);
  }
};

// Get user groups
exports.getUserGroups = async (req, res, next) => {
  try {
    const currentUser = req.user.username;
    const groups = await Conversation.find({
      participants: currentUser,
      type: 'group'
    })
      .sort({ lastMessageTimestamp: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      groups
    });
  } catch (error) {
    logger.error('Failed to fetch user groups:', error);
    next(error);
  }
};

// Create group
exports.createGroup = async (req, res, next) => {
  try {
    const { groupName, members } = req.body;
    const currentUsername = req.user.username;

    // Validate members exist
    const uniqueMembers = [...new Set(members.map(m => m.toLowerCase()))];
    const existingUsers = await User.find({
      username: { $in: uniqueMembers }
    }).select('username');

    const existingUsernames = existingUsers.map(u => u.username);
    const invalidMembers = uniqueMembers.filter(m => !existingUsernames.includes(m));

    if (invalidMembers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some users do not exist',
        invalidMembers
      });
    }

    const newGroup = new Conversation({
      type: 'group',
      name: groupName.trim(),
      participants: [currentUsername, ...uniqueMembers]
    });

    await newGroup.save();
    logger.info(`Group created: ${groupName} by ${currentUsername}`);

    res.status(201).json({
      success: true,
      groupId: newGroup._id,
      groupName: newGroup.name
    });
  } catch (error) {
    logger.error('Failed to create group:', error);
    next(error);
  }
};

// Send group message
exports.sendGroupMessage = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;
    const from = req.user.username;

    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This is not a group conversation'
      });
    }

    // Verify user is part of group
    if (!group.participants.includes(from)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this group'
      });
    }

    const newMessage = new Message({
      conversationId: groupId,
      from,
      content: content.trim()
    });

    await newMessage.save();

    // Update conversation's last message info
    group.lastMessageTimestamp = new Date();
    group.lastMessage = content.trim();
    group.lastMessageFrom = from;
    await group.save();

    res.status(201).json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    logger.error('Failed to send group message:', error);
    next(error);
  }
};

// Get call history
exports.getCallHistory = async (req, res, next) => {
  try {
    const username = req.user.username;
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const callHistory = await CallHistory.find({
      $or: [{ caller: username }, { receiver: username }]
    })
      .sort({ startTime: -1 })
      .limit(limit)
      .skip(skip);

    const total = await CallHistory.countDocuments({
      $or: [{ caller: username }, { receiver: username }]
    });

    res.status(200).json({
      success: true,
      callHistory,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching call history:', error);
    next(error);
  }
};
