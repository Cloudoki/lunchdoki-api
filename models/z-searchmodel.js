const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const zSearchSchema = new Schema({
    name: String,
    alias: Object,
    searches: Number
});

module.exports = zmSearch = mongoose.model('zm-searches', zSearchSchema);