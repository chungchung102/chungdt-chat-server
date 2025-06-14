const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const NodeCache = require('node-cache');
const fetch = require('node-fetch'); // ✅ Đã sửa: Dùng require thay vì import()

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

// ✅ API key gán trực tiếp (bạn tự chịu trách nhiệm bảo mật)
const apiKey = 'AIzaSyC7hCmE_c1V4FfO1li5S_nzMn9xqOcad8U';

app.get('/search-youtube', async (req, res) => {
    const query = req.query.q;
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
        console.log(`Fetching from YouTube API for query: ${query}`);
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            cache.set(cacheKey, data);
            res.json(data);
        } else {
            console.error('YouTube API error:', data.error);
            res.status(response.status).json({ error: data.error?.message || 'Unknown error' });
        }
    } catch (error) {
        console.error('Fetch error:', error);
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
// Caro game logic
const games = {};
const BOARD_SIZE = 15;

function createNewGame() {
    const board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
    return {
        players: {},
        board,
        currentTurn: null,
        moveCount: 0
    };
}

function checkWin(board, row, col, symbol) {
    const directions = [
        [[0, 1], [0, -1]], // Horizontal
        [[1, 0], [-1, 0]], // Vertical
        [[1, 1], [-1, -1]], // Diagonal
        [[1, -1], [-1, 1]]  // Anti-diagonal
    ];

    for (const [dir1, dir2] of directions) {
        let count = 1;
        for (const [dr, dc] of [dir1, dir2]) {
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === symbol) {
                count++;
                r += dr;
                c += dc;
            }
        }
        if (count >= 5) return true;
    }
    return false;
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('message', (data) => {
        const messageData = {
            username: data.username || 'Anonymous',
            message: data.message,
            timestamp: data.timestamp || new Date().toISOString()
        };
        io.emit('message', messageData);
    });

    socket.on('joinGame', (data) => {
        let gameId = Object.keys(games).find(id => Object.keys(games[id].players).length < 2);
        if (!gameId) {
            gameId = Date.now().toString();
            games[gameId] = createNewGame();
        }

        games[gameId].players[socket.id] = Object.keys(games[gameId].players).length === 0 ? 'X' : 'O';
        socket.join(gameId);
        if (Object.keys(games[gameId].players).length === 2) {
            games[gameId].currentTurn = Object.keys(games[gameId].players)[0];
        }
        io.to(gameId).emit('gameState', games[gameId]);
    });

    socket.on('makeMove', ({ row, col }) => {
        const gameId = Object.keys(games).find(id => games[id].players[socket.id]);
        if (!gameId || games[gameId].currentTurn !== socket.id || games[gameId].board[row][col]) return;

        const symbol = games[gameId].players[socket.id];
        games[gameId].board[row][col] = symbol;
        games[gameId].moveCount++;

        if (checkWin(games[gameId].board, row, col, symbol)) {
            io.to(gameId).emit('gameOver', { winner: symbol });
            delete games[gameId];
        } else if (games[gameId].moveCount === BOARD_SIZE * BOARD_SIZE) {
            io.to(gameId).emit('gameOver', { winner: null });
            delete games[gameId];
        } else {
            games[gameId].currentTurn = Object.keys(games[gameId].players).find(id => id !== socket.id);
            io.to(gameId).emit('gameState', games[gameId]);
        }
    });

    socket.on('newGame', () => {
        const gameId = Object.keys(games).find(id => games[id].players[socket.id]);
        if (gameId) {
            games[gameId] = createNewGame();
            games[gameId].players = { [socket.id]: games[gameId].players[socket.id] };
            socket.join(gameId);
            io.to(gameId).emit('gameState', games[gameId]);
        }
    });

    socket.on('resign', () => {
        const gameId = Object.keys(games).find(id => games[id].players[socket.id]);
        if (gameId) {
            const winner = Object.keys(games[gameId].players).find(id => id !== socket.id);
            io.to(gameId).emit('gameOver', { winner: games[gameId].players[winner] });
            delete games[gameId];
        }
    });

    socket.on('quitGame', () => {
        const gameId = Object.keys(games).find(id => games[id].players[socket.id]);
        if (gameId) {
            delete games[gameId].players[socket.id];
            io.to(gameId).emit('gameOver', { winner: null });
            if (Object.keys(games[gameId].players).length === 0) {
                delete games[gameId];
            } else {
                io.to(gameId).emit('gameState', games[gameId]);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        const gameId = Object.keys(games).find(id => games[id].players[socket.id]);
        if (gameId) {
            delete games[gameId].players[socket.id];
            io.to(gameId).emit('gameOver', { winner: null });
            if (Object.keys(games[gameId].players).length === 0) {
                delete games[gameId];
            }
        }
    });
});

// 🚪 Port cho Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
