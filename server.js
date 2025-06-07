const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['https://chungdt-front-end.onrender.com', 'https://www.chungdt.tk'], // Giới hạn CORS
        methods: ['GET', 'POST']
    }
});

app.use(cors());

// Endpoint kiểm tra server
app.get('/', (req, res) => {
    res.send('Socket.IO server for chungdt is running');
});

// Endpoint YouTube API với cache
const cache = new NodeCache({ stdTTL: 600 }); // Cache 10 phút
app.get('/search-youtube', async (req, res) => {
    const query = req.query.q;
    const apiKey = process.env.YOUTUBE_API_KEY;
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
        res.status(500).json({ error: 'Failed to fetch YouTube data' });
    }
});

// Xử lý Socket.IO
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('message', (data) => {
        const messageData = {
            username: data.username || 'Anonymous',
            message: data.message,
            timestamp: new Date().toISOString()
        };
        io.emit('message', messageData); // Gửi tin nhắn đến tất cả client
    });
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});