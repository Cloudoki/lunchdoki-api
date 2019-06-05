const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const zrespModelSchema = new Schema({
    _id: Schema.Types.Mixed,
    slack_interface: Object
}, {
    strict: false,
    timestamps: true
});

module.exports = zmResponse = mongoose.model('zm-response', zrespModelSchema);