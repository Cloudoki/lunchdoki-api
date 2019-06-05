const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const zbaseModelSchema = new Schema({
    rid: Number,
    slack_interface: Object
}, {
    timestamps: true
});

module.exports = zmModel = mongoose.model('zm-base', zbaseModelSchema);