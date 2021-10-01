const express = require("express");
const app = express();
const port = 3100;

const Chat = require("./schemas/chat");
const Message = require("./schemas/message");
const cors = require("cors");
const mongoose = require("./database");
const {ObjectId} = require("mongodb");
const {log} = require("nodemon/lib/utils");

const server = app.listen(port, () =>
    console.log("Server listening on port " + port)
);
const io = require("socket.io")(server, {pingTimeout: 60000});

app.use(express.json());
app.use(cors());

app.post("/get_chat", async (req, res) => {
    const {user, receiver} = req.body;
    let chat = await Chat.findOne({
        users: {
            $all: [
                {$elemMatch: {id: {$eq: user.id}}},
                {$elemMatch: {id: {$eq: receiver.id}}},
            ],
        },
    });
    if (chat == null) {
        chat = await getChatByUserId(user, receiver);
    }
    res.json(chat).end();
});
app.post("/messages/send", async (req, res) => {
    if (!req.body.content || !req.body.chat || !req.body.sender || !req.body.users) {
        return res.sendStatus(400);
    }

    const newMessage = {
        sender: req.body.sender,
        content: req.body.content,
        chat: req.body.chat,
        users: req.body.users
    };

    Message.create(newMessage)
        .then(async (message) => {
            message = await message.populate("chat").execPopulate();

            Chat.findByIdAndUpdate(req.body.chat, {latestMessage: message}).catch(
                (error) => console.log(error)
            );
            res.status(201).send(message);
        })
        .catch((error) => {
            console.log(error);
            res.sendStatus(400);
        });
});
app.post("/messages/get/:chat", async (req, res) => {
    Message.find(
        {chat: req.params.chat},
        {},
        {limit: 10, skip: req.body.skip}
    )
        .sort({_id: -1})
        .then((results) => res.status(200).send(results))
        .catch((error) => {
            console.log(error);
            res.sendStatus(400);
        });
});
app.post("/get_all_chats/:userId", async (req, res) => {
    Chat.find({
        latestMessage: {$exists: true},
        users: {
            $elemMatch: {
                id: {$eq: req.params.userId},
            },
        },
    })
        .populate("latestMessage")
        .sort({updatedAt: -1})
        .then((results) => {
            res.status(200).send(results);
        })
        .catch((error) => {
            console.log(error);
            res.sendStatus(400);
        });
});
app.post("/get_unread_messages/:chat", async (req, res) => {
    Message.find({
        chat: new ObjectId(req.params.chat),
        read: 0,
        sender: {$ne: req.body.receiver},
    })
        .countDocuments()
        .then((results) => {
            res.status(200).json({results});
        })
        .catch((error) => {
            console.log(error);
            res.sendStatus(400);
        });
});
app.post("/get_unread_messages_count/:user", async (req, res) => {
    Message.find({
        users: {
            $elemMatch: {id: req.params.user.toString()}
        },
        read: 0,
    }, {}, {limit: 1})
        .countDocuments()
        .then((results) => {
            res.status(200).json({results});
        })
        .catch((error) => {
            console.log(error);
            res.sendStatus(400);
        });
});
app.delete("/messages/delete", async (req, res) => {
    if (!req.body.sender) return res.sendStatus(401);

    Message.findOneAndDelete({
        _id: ObjectId(req.body.id),
        sender: {$eq: req.body.sender},
    })
        .then((result) => {
            Message.find(
                {chat: req.body.chat},
                {},
                {limit: 1}
            )
                .sort({_id: -1})
                .then(async (message) => {
                    Chat.findByIdAndUpdate(req.body.chat, {latestMessage: ObjectId(message[0]._id)})
                        .catch((error) => console.log(error));
                })
            res.status(202).json(result)
        })
        .catch((e) => {
            res.status(400).json({error: e})
        })
})
app.post("/unread_all/:chat", async (req, res) => {
    Message.updateMany(
        {
            chat: new ObjectId(req.params.chat),
            read: 0,
            sender: {$ne: req.body.receiver},
        },
        {
            read: 1,
        },
        (err, result) => {
            console.log(result);
        }
    )
        .then((results) => {
            res.sendStatus(200);
        })
        .catch((error) => {
            console.log(error);
            res.sendStatus(400);
        });
});

function getChatByUserId(user, receiver) {
    console.log(user, receiver);
    return Chat.findOneAndUpdate(
        {
            isGroupChat: false,
            users: {
                $size: 2,
                $all: [
                    {$elemMatch: {id: {$eq: user.id}}},
                    {$elemMatch: {id: {$eq: receiver.id}}},
                ],
            },
        },
        {
            $setOnInsert: {
                users: [user, receiver],
            },
        },
        {
            new: true,
            upsert: true,
        }
    );
}

io.on("connection", (socket) => {
    socket.on("setup", (userData) => {
        // console.log(socket.client)
        console.log("setup", userData.id);
        if (!socket.rooms[userData.id.toString()]) {
            socket.join(userData.id.toString());
            socket.emit("connected");
        }
    });

    socket.on("disconnect", () => {
        console.log("disconnect", socket.id);
    });

    socket.on("join room", (room) => {
        socket.join(room);
    });

    socket.on("in room", (room) => {
        if (socket.adapter.rooms[room].length > 1) {
            Message.updateMany(
                {
                    chat: new ObjectId(room),
                    read: 0,
                },
                {
                    read: 1,
                },
                (err, result) => {
                    console.log(result);
                }
            );
        }
        socket.in(room).emit("in room");
    });

    socket.on("leave room", (room) => {
        console.log(">>>room leave", room);
    });

    socket.on("typing", (room) => {
        socket.in(room).emit("typing");
    });

    socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

    socket.on("new message", (newMessage) => {
        if (!newMessage.users) return console.log("Chat.users not defined");
        newMessage.date = new Date().toISOString();
        newMessage.users.forEach((user) => {
            if (user.id !== newMessage.sender) {
                socket.in(user.id).emit("message received", newMessage);
            }
        });
    });

    socket.on("message notification", (newMessage) => {
        if (!newMessage.users) return console.log("Chat.users not defined");
        newMessage.date = new Date().toISOString();
        newMessage.users.forEach((user) => {
            if (user.id !== newMessage.sender) {
                socket.in(user.id).emit("message notification", newMessage);
            }
        });
    });

    socket.on("read message", (data) => {
        if (socket.adapter.rooms[data.room].length > 1) {
            Message.findByIdAndUpdate(
                data.id,
                {
                    read: 1,
                },
                (err, result) => {
                    console.log(result);
                }
            );
            socket.in(data.room).emit("read message");
        }
    });

    socket.on("delete message", data => {
        console.log(data)
        socket.in(data.chatId).emit("delete message", data.messageId)
    })
});
