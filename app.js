const express = require('express');
const app = express();
const port = 4000;

const Chat = require('./schemas/chat')
const Message = require('./schemas/message')
const cors = require("cors");
const mongoose = require("./database");

const server = app.listen(port, () => console.log("Server listening on port " + port));
const io = require("socket.io")(server, {pingTimeout: 60000});

app.use(express.json());
app.use(cors());

app.post("/get_chat/:receiverId", async (req, res) => {
    const {userId} = req.body;
    let chat = await Chat.findOne({
        users: {
            $all: [
                {$elemMatch: {$eq: userId}},
                {$elemMatch: {$eq: req.params.receiverId}},
            ],
        },
    })
    if (chat == null) {
        chat = await getChatByUserId(userId, req.params.receiverId,);
    }
    res.json(chat).end();
})
app.post('/messages/send', async (req, res) => {
    if (!req.body.content || !req.body.chat) {
        return res.sendStatus(400);
    }

    const newMessage = {
        sender: req.body.sender,
        content: req.body.content,
        chat: req.body.chat,
    };

    Message.create(newMessage)
        .then(async message => {
            message = await message.populate("chat").execPopulate();

            Chat.findByIdAndUpdate(req.body.chat, {latestMessage: message})
                .catch(error => console.log(error));
            res.status(201).send(message);
        })
        .catch(error => {
            console.log(error)
            res.sendStatus(400);
        })
})
app.post('/messages/get/:chat', async (req, res) => {

    Message.find({chat: req.params.chat}, {}, {limit: 10}).sort({_id: -1})
        .then(results => res.status(200).send(results))
        .catch(error => {
            console.log(error);
            res.sendStatus(400);
        })
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
    );
}

io.on("connection", socket => {

    socket.on("setup", userData => {
        socket.join(userData.id.toString());
        socket.emit("connected");
    })

    socket.on("join room", room => {
        console.log(">>>room", room);
        socket.join(room);
    });
    socket.on("leave room", room => {
        console.log(">>>room leave", room);
        socket.leave(room);
    });

    socket.on("typing", room => {
        socket.in(room).emit("typing");
    });
    socket.on("stop typing", room => socket.in(room).emit("stop typing"));


    socket.on("new message", newMessage => {

        if (!newMessage.users) return console.log("Chat.users not defined");
        newMessage.date = new Date().toISOString()
        newMessage.users.forEach(user => {
            if (user !== newMessage.sender) {
                socket.in(user).emit("message received", newMessage);
            }
        });
    });
})