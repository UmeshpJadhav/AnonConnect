const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { log } = require('console');
const { waitForDebugger } = require('inspector');


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


let waitingusers = [];
let rooms = {};


io.on("connection", function(socket) {
     socket.on("joinroom", function(){
       //idharr waiting user ka logic aayega matlab agar waiting user me zero se jyada  hai matalab koi to hai nahi to koin nahi matlab zero hai to hum khudko daal dege matlab socket ko push kardenege
       if(waitingusers.length > 0){
   //idhar shift user karke waiting users se partner mai daal denge to hume partner mil jayega jisse hamri batchit hogi
      let partner = waitingusers.shift();
      const roomname = `${socket.id}-${partner.id}`;

      socket.join(roomname);
      partner.join(roomname);


      io.to(roomname).emit("joined" , roomname);


       }
       else{
        waitingusers.push(socket)
       }
     });


     socket.on('startVideoCall', (data) => {
      const { room } = data;
      console.log(`startVideoCall event from ${socket.id} for room ${room}`);
      // Send an incoming call event to everyone in the room except the sender.
      socket.to(room).emit('incomingCall');
    });
  
    // When the callee accepts the call.
    socket.on('acceptCall', (data) => {
      const { room } = data;
      console.log(`acceptCall event from ${socket.id} for room ${room}`);
      // Notify the other participant in the room that the call was accepted.
      socket.to(room).emit('callAccepted');
    });
  
    // When the callee rejects the call.
    socket.on('rejectCall', (data) => {
      const { room } = data;
      console.log(`rejectCall event from ${socket.id} for room ${room}`);
      // Notify the other participant that the call was rejected.
      socket.to(room).emit('callRejected');
    });
           
     socket.on("disconnect" , function(){
        let index =  waitingusers.findIndex(
            (waitingUser) => waitingUser.id === socket.id
          );
    
          if(index !== -1) {
            waitingusers.splice(index , 1);
          }
    });

    socket.on("typing", ({ room }) => {
        socket.to(room).emit("userTyping");
    });
  
   
      socket.on("startVideoCall", ({ room }) => {
      socket.broadcast.to(room).emit("incomingCall");

      socket.on("acceptCall", ({ room }) => {
        socket.broadcast.to(room).emit("callAccepted")
    });

    socket.on("rejectCall", ({ room }) => {
      socket.to(room).emit("callRejected");
    });
});

});
    

    


app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));


server.listen(3000, () => {  
    console.log('Server is running on port 3000');
});
