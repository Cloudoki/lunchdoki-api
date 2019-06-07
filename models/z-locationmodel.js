const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const zLocationModelSchema = new Schema({
    loc_id: Number,
    gm_location_name: String,
    lat: Number,
    lng: Number,
    zomato_gen_url: String
});

module.exports = zmModel = mongoose.model('zm-location', zLocationModelSchema);