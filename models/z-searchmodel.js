const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const zSearchSchema = new Schema({
    search_value: String,
    searches: {type: Number, default: 1}, 
    date: Date,
    latest_user: String
});

module.exports = zmSearch = mongoose.model('zm-searches', zSearchSchema);