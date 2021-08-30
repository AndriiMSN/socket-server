const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    sender: {type: String, trim: true},
    content: {type: String, trim: true},
    chat: {type: Schema.Types.ObjectId, ref: 'Chat'},
    date: {type: Date, default: new Date()},
    readBy: [{type: String, trim: true}]
}, {timestamps: true});

module.exports = mongoose.model('Message', messageSchema);