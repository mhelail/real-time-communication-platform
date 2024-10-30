const User = require('../models/User'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation'); // Yeni model içe aktarıldı

// Kullanıcı kaydı
exports.register = async (req, res) => {
    const { username, password } = req.body;

    // Kullanıcı var mı kontrol et
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.status(400).json({ message: 'Kullanıcı adı zaten alınmış' });
    }

    try {
        // Şifreyi hashle
        const hashedPassword = await bcrypt.hash(password, 10);

        // Yeni kullanıcı oluştur
        const newUser = new User({
            username,
            password: hashedPassword,
        });

        await newUser.save();
        res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi' });
    } catch (error) {
        res.status(500).json({ message: 'Kayıt hatası', error });
    }
};

// Kullanıcı girişi
exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // Kullanıcıyı bul
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: "Kullanıcı bulunamadı" });
        }

        // Şifreyi karşılaştır
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Şifre hatalı" });
        }

        // JWT tokenı oluştur
        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Başarılı giriş işlemleri
        res.status(200).json({ message: "Giriş başarılı", token });
    } catch (error) {
        res.status(500).json({ message: "Giriş hatası", error });
    }
};

// Kullanıcının konuşmalarını getir
exports.getConversations = async (req, res) => {
    const username = req.user.username;

    try {
        // Kullanıcının dahil olduğu tüm konuşmaları bul
        const conversations = await Conversation.find({ participants: username });

        const conversationUsers = conversations.map(conversation =>
            conversation.participants.find(participant => participant !== username)
        );

        res.status(200).json({ conversations: conversationUsers });
    } catch (error) {
        res.status(500).json({ message: 'Konuşmalar getirilirken hata oluştu', error });
    }
};

// Kullanıcı adını arayarak kullanıcıları bul
exports.searchUsers = async (req, res) => {
    let searchTerm = req.query.username ? req.query.username.trim() : "";
    const currentUsername = req.user.username;

    console.log("DEBUG: Alınan Arama Terimi:", searchTerm);
    console.log("DEBUG: Mevcut Kullanıcı:", currentUsername);

    // Eğer arama terimi boşsa, işlem yapmaya gerek yok
    if (!searchTerm) {
        console.log("DEBUG: Arama terimi boş, kullanıcı yok.");
        return res.status(200).json({ users: [] });
    }

    try {
        // Arama terimine uygun kullanıcıları bul
        const regex = new RegExp(`^${searchTerm}`, 'i'); // Başlayan, büyük/küçük harf duyarsız

        console.log("DEBUG: Oluşturulan Regex:", regex);

        const users = await User.find({
            username: { $regex: regex },  // Kullanıcı adı arama terimi ile başlayanları filtrele
            _id: { $ne: req.user.id }     // Mevcut kullanıcıyı hariç tut
        }).select('username _id');

        console.log("DEBUG: Bulunan Kullanıcı Sayısı:", users.length);
        console.log("DEBUG: Bulunan Kullanıcılar:", users);

        return res.status(200).json({ users });
    } catch (error) {
        console.error("DEBUG: Kullanıcılar aranırken hata oluştu:", error);
        return res.status(500).json({ message: 'Kullanıcı arama hatası', error });
    }
};

// İki kullanıcı arasındaki konuşmayı oluştur veya bul
exports.createOrFindConversation = async (req, res) => {
    const { username } = req.body; // Diğer kullanıcının kullanıcı adı
    const currentUsername = req.user.username;

    try {
        // Zaten var olan bir konuşmayı kontrol et
        let conversation = await Conversation.findOne({
            participants: { $all: [currentUsername, username] }
        });

        if (!conversation) {
            // Eğer konuşma yoksa, yeni bir konuşma oluştur
            conversation = new Conversation({
                participants: [currentUsername, username]
            });
            await conversation.save();
        }

        // Respond with the conversation ID directly
        res.status(200).json({ conversationId: conversation._id });
    } catch (error) {
        res.status(500).json({ message: 'Konuşma oluşturulurken veya bulunurken hata oluştu', error });
    }
};

// Belirli bir konuşmanın mesajlarını getir
exports.getMessages = async (req, res) => {
    const { conversationId } = req.params;

    try {
        const messages = await Message.find({ conversationId }).sort('timestamp');
        res.status(200).json({ messages });
    } catch (error) {
        res.status(500).json({ message: 'Mesajlar getirilirken hata oluştu', error });
    }
};

// Konuşmada mesaj gönder
exports.sendMessage = async (req, res) => {
    const { conversationId, content } = req.body;
    const from = req.user.username;

    console.log("DEBUG: Received message data:", { conversationId, from, content });

    if (!conversationId || !content) {
        return res.status(400).json({ message: "Conversation ID and message content are required" });
    }

    try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            console.error("DEBUG: Conversation not found with ID:", conversationId);
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Identify the recipient
        const to = conversation.participants.find(participant => participant !== from);

        // Create and save the new message
        const newMessage = new Message({
            conversationId,
            from,
            to,
            content,
            timestamp: new Date() // Ensure timestamp is being recorded
        });

        await newMessage.save();
        console.log("DEBUG: Message saved successfully:", newMessage);

        res.status(201).json({ newMessage });
    } catch (error) {
        console.error("DEBUG: Error saving message:", error);
        res.status(500).json({ message: "Error saving message", error });
    }
};
