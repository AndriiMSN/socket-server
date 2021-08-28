const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatSchema = new Schema({
    chatName: {type: String, trim: true},
    isGroupChat: {type: Boolean, default: false},
    users: [{type: String, trim: true}],
    messages: [{
        sender: {type: String, trim: true},
        content: {type: String, trim: true},
        date: {type: Date, default: Date.now()},
        readBy: [{type: Number, user: String}]
    }]
}, {timestamps: true});

module.exports = mongoose.model('Chat', chatSchema);