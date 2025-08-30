const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const users = [];

io.on('connection', (socket) => {
  console.log('user connected');
  
  socket.on('join', (username) => {
    users.push({ id: socket.id, username: username });
    io.emit('user joined', username);
    io.emit('users list', users.map(u => u.username));
  });
  
  socket.on('message', (msg) => {
    const user = users.find(u => u.id === socket.id);
    const username = user ? user.username : 'Anonymous';
    io.emit('message', { username: username, message: msg });
  });
  
  // Voice chat events
  socket.on('voice_started', (username) => {
    io.emit('voice_started', username);
  });
  
  socket.on('voice_stopped', (username) => {
    io.emit('voice_stopped', username);
  });
  
  // WebRTC signaling events
  socket.on('offer', (data) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      data.from = user.username;
      socket.broadcast.emit('offer', data);
    }
  });
  
  socket.on('answer', (data) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      data.from = user.username;
      socket.broadcast.emit('answer', data);
    }
  });
  
  socket.on('ice_candidate', (data) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      data.from = user.username;
      socket.broadcast.emit('ice_candidate', data);
    }
  });
  
  // Handle mute status updates
  socket.on('mute_status', (data) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      socket.broadcast.emit('mute_status_update', {
        username: user.username,
        type: data.type,
        muted: data.muted
      });
    }
  });
  
  // Handle screen sharing updates
  socket.on('screen_share_update', (data) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      socket.broadcast.emit('screen_share_update', {
        username: user.username,
        sharing: data.sharing
      });
    }
  });
  
  // Handle users list requests
  socket.on('request_users_list', () => {
    socket.emit('users list', users.map(u => u.username));
  });
  
  socket.on('disconnect', () => {
    const index = users.findIndex(u => u.id === socket.id);
    if (index > -1) {
      const username = users[index].username;
      users.splice(index, 1);
      io.emit('user left', username);
      io.emit('users list', users.map(u => u.username));
    }
  });
});

// Vercel için port yapılandırması
const port = process.env.PORT || 3000;

// Vercel'de çalışırken server.listen() çağrılmamalı
if (process.env.NODE_ENV !== 'production') {
  server.listen(port, () => {
    console.log(`server running on port ${port}`);
  });
}

// Vercel için export
module.exports = app;
