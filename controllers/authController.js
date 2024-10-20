const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Başarılı giriş işlemleri
        res.status(200).json({ message: "Giriş başarılı", token });
    } catch (error) {
        res.status(500).json({ message: "Giriş hatası", error });
    }
};

