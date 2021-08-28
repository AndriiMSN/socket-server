const express = require('express');
const app = express();
const port = 4000;

const path = require('path')
const bodyParser = require("body-parser")
const mongoose = require("./database");
const Chat = require('./schemas/chat')
const cors = require("cors");

const server = app.listen(port, () => console.log("Server listening on port " + port));
const io = require("socket.io")(server, {pingTimeout: 60000});


app.use(express.json())
app.use(cors())

app.post("/:receiverId", async (req, res) => {
    const {userId} = req.body
    let chat = await Chat.findOne({
        users: {
            $all: [
                {$elemMatch: {$eq: userId}},
                {$elemMatch: {$eq: req.params.receiverId}},
            ],
        },
    })
    console.log(chat)

    if (chat == null) {
        chat = await getChatByUserId(userId, req.params.receiverId,);
    }
    res.json(chat).end()
})

function getChatByUserId(userLoggedInId, otherUserId) {
    return Chat.findOneAndUpdate(
        {
            isGroupChat: false,
            users: {
                $size: 2,
                $all: [
                    {$elemMatch: {$eq: userLoggedInId}},
                    {$elemMatch: {$eq: otherUserId}},
                ],
            },
        },
        {
            $setOnInsert: {
                users: [userLoggedInId, otherUserId],
            },
        },
        {
            new: true,
            upsert: true,
        }
    )
}

io.on("connection", socket => {

    socket.on("setup", userData => {
        socket.join(userData.id);
        socket.emit("connected");
    })

    socket.on("join room", room => {
        console.log(">>>room", room)
        socket.join(room)
    });
    socket.on("leave room", room => {
        console.log(">>>room leave", room)
        socket.leave(room)
    });
    socket.on("typing", room => {
        socket.in(room).emit("typing")
    });
    socket.on("stop typing", room => socket.in(room).emit("stop typing"));


    socket.on("new message", newMessage => {
        const chat = newMessage.chat;

        if (!chat.users) return console.log("Chat.users not defined");

        chat.users.forEach(user => {

            if (user._id === newMessage.sender._id) return;
            console.log(user);
            socket.in(user._id).emit("message received", newMessage);
        })
    });
})