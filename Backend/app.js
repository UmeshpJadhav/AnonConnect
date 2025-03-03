const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');


app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173', 
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});


io.on("connection", function(socket) {
    console.log("New client connected");
    
    
    socket.emit('message', 'Welcome to the server!');
    
   
    socket.on('clientMessage', (data) => {
        console.log('Received message from client:', data);
    });

    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
server.listen(3000, () => {  
    console.log('Server is running on port 3001');
});
