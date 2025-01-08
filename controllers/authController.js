const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const CallHistory = require('../models/CallHistory'); // Import the call history model

// Register
exports.register = async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ message: 'Username is already taken' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ 
      message: 'User registered successfully', 
      redirect: '/login.html' // Sending redirection info to the frontend
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration error', error });
  }
};

// Login
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Login error", error });
  }
};

// Create or find conversation
exports.createOrFindConversation = async (req, res) => {
  const { username } = req.body;
  const currentUsername = req.user.username;
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUsername, username] },
      type: 'private'
    });

    if (!conversation) {
      conversation = new Conversation({
        type: 'private',
        participants: [currentUsername, username]
      });
      await conversation.save();
    }

    res.status(200).json({ conversationId: conversation._id });
  } catch (error) {
    res.status(500).json({ message: 'Error creating or finding conversation', error });
  }
};

// Get user's conversations
exports.getConversations = async (req, res) => {
  const username = req.user.username;
  try {
    const conversations = await Conversation.find({ participants: username }).sort({ lastMessageTimestamp: -1 });
    const formattedConversations = conversations.map(conversation => {
      if (conversation.type === 'group') {
        return {
          conversationId: conversation._id,
          type: 'group',
          name: conversation.name,
          lastMessageTimestamp: conversation.lastMessageTimestamp
        };
      } else {
        const participant = conversation.participants.find(part => part !== username);
        return {
          conversationId: conversation._id,
          type: 'private',
          username: participant || 'Unnamed User',
          lastMessageTimestamp: conversation.lastMessageTimestamp
        };
      }
    });
    res.status(200).json({ conversations: formattedConversations });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching conversations', error });
  }
};

// Search users and groups
exports.searchUsers = async (req, res) => {
  let searchTerm = req.query.username ? req.query.username.trim() : "";
  const currentUsername = req.user.username;

  if (!searchTerm) {
    return res.status(200).json({ users: [], groups: [] });
  }

  try {
    const regex = new RegExp(searchTerm, 'i');

    const users = await User.find({
      username: { $regex: regex },
      _id: { $ne: req.user.id }
    }).select('username _id');

    if (regex.test(currentUsername)) {
      users.push({ username: currentUsername, _id: req.user.id });
    }

    const userGroups = await Conversation.find({
      participants: { $in: [currentUsername] },
      type: 'group',
      name: { $regex: regex }
    }).select('name _id');

    return res.status(200).json({ users, groups: userGroups });
  } catch (error) {
    console.error("DEBUG: Error searching users and groups:", error);
    return res.status(500).json({ message: 'Search error', error });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('username _id');
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error });
  }
};

// Get private messages
exports.getPrivateMessages = async (req, res) => {
  const { conversationId } = req.params;
  try {
    const messages = await Message.find({ conversationId }).sort('timestamp');
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching private messages', error });
  }
};

// Get group messages
exports.getGroupMessages = async (req, res) => {
  const { groupId } = req.params;
  try {
    const messages = await Message.find({ conversationId: groupId }).sort('timestamp');
    res.status(200).json({ messages });
  } catch (error) {
    console.error('Error getting group messages:', error);
    res.status(500).json({ message: 'Error fetching group messages', error });
  }
};

// Send private message
exports.sendMessage = async (req, res) => {
  const { conversationId, content } = req.body;
  const from = req.user.username;

  if (!conversationId || !content) {
    return res.status(400).json({ message: "Conversation ID and message content are required" });
  }

  try {
    let conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(400).json({ message: 'Conversation not found' });
    }

    const toUser = conversation.participants.find(participant => participant !== from);

    const newMessage = new Message({
      conversationId,
      from,
      to: toUser,
      content,
      timestamp: new Date()
    });

    await newMessage.save();
    res.status(201).json({ newMessage });
  } catch (error) {
    res.status(500).json({ message: "Error sending message", error });
  }
};

// Get user groups
exports.getUserGroups = async (req, res) => {
  const currentUser = req.user.username;
  try {
    const groups = await Conversation.find({ participants: currentUser, type: 'group' })
      .populate('participants', 'username')
      .sort({ lastMessageTimestamp: -1 });
    res.status(200).json({ groups });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user groups', error });
  }
};

// Create group
exports.createGroup = async (req, res) => {
  const { groupName, members } = req.body;
  const currentUsername = req.user.username;

  if (!groupName || !members || members.length < 1) {
    return res.status(400).json({ message: 'Group name and at least one member are required' });
  }

  try {
    const newGroup = new Conversation({
      type: 'group',
      name: groupName,
      participants: [currentUsername, ...members],
      createdAt: new Date(),
      lastMessageTimestamp: new Date(),
    });

    await newGroup.save();
    res.status(201).json({ groupId: newGroup._id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create group', error });
  }
};

// Send group message
exports.sendGroupMessage = async (req, res) => {
  const { groupId } = req.params;
  const { content } = req.body;
  const from = req.user.username;

  try {
    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const newMessage = new Message({
      conversationId: groupId,
      from,
      content,
      timestamp: new Date(),
    });

    await newMessage.save();

    // Emitting to socket is handled in app.js on message event if needed
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message', error });
  }
};

// Get call history
exports.getCallHistory = async (req, res) => {
  try {
    const username = req.user.username;
    const callHistory = await CallHistory.find({
      $or: [{ caller: username }, { receiver: username }]
    }).sort({ startTime: -1 });

    res.status(200).json({ callHistory });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching call history', error });
  }
};
