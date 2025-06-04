const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Cho phép tất cả nguồn (có thể giới hạn khi triển khai)
        methods: ['GET', 'POST']
    }
});

app.get('/', (req, res) => {
    res.send('Socket.IO server for chungdt is running');
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('message', (msg) => {
        io.emit('message', msg); // Gửi tin nhắn đến tất cả client
    });
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});