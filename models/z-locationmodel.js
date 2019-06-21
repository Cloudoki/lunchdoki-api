const mongoose = require('mongoose');
const autoIncrement = require('mongoose-sequence')(mongoose);
const Schema = mongoose.Schema;

const zLocationModelSchema = new Schema({
    gm_location_name: String,
    lat: Number,
    lng: Number,
    zomato_gen_url: String,
    selected: Boolean
});

zLocationModelSchema.plugin(autoIncrement, {inc_field: 'loc_id'})

module.exports = zmModel = mongoose.model('zm-location', zLocationModelSchema);