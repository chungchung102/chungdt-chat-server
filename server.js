const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const NodeCache = require('node-cache');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // để dùng fetch trong Node

const app = express();
const server = http.createServer(app);

// 🔧 Cấu hình CORS dùng chung cho Express và Socket.IO
const corsOptions = {
    origin: ['https://chungdt-front-end.onrender.com', 'https://www.chungdt.tk'],
    methods: ['GET', 'POST'],
    credentials: true
};

app.use(cors(corsOptions));

// 🚀 Socket.IO với cấu hình CORS đúng
const io = new Server(server, {
    cors: corsOptions
});

// ✅ Kiểm tra server có hoạt động không
app.get('/', (req, res) => {
    res.send('Socket.IO server for chungdt is running');
});

// 🔁 YouTube API + Cache
const cache = new NodeCache({ stdTTL: 600 });
app.get('/search-youtube', async (req, res) => {
    const query = req.query.q;
    const apiKey = 'AIzaSyC7hCmE_c1V4FfO1li5S_nzMn9xqOcad8U';
    if (!query || !apiKey) {
        return res.status(400).json({ error: 'Missing query or API key' });
    }

    const cacheKey = `yt_${encodeURIComponent(query)}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
        console.log(`Cache hit for query: ${query}`);
        return res.json(cachedResult);
    }

    try {
        console.log(`Fetching from API for query: ${query}`);
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${apiKey}`);
        const data = await response.json();
        if (response.ok) {
            cache.set(cacheKey, data);
            res.json(data);
        } else {
            res.status(response.status).json({ error: data.error.message });
        }
    } catch (error) {
        console.error('Error fetching YouTube data:', error);
        res.status(500).json({ error: 'Failed to fetch YouTube data' });
    }
});

// 💬 Socket.IO chat
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('message', (data) => {
        const messageData = {
            username: data.username || 'Anonymous',
            message: data.message,
            timestamp: new Date().toISOString()
        };
        io.emit('message', messageData);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// 🚪 Port cho Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
