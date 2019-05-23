const express = require('express');
const axios = require('axios');
const geolib = require('geolib');
const router = express.Router();

const options = {
    method: 'GET',
    headers: {'user-key': 'de4fa22b5fad42417f1e8041249ebdbb'},
    url: 'https://developers.zomato.com/api/v2.1/search?entity_id=82029&entity_type=subzone&lat=38.728579&lon=-9.152448&radius=1000&sort=real_distance&order=asc'
}


axios(options)
    .then((res) => {
        const both = res.data.restaurants.map(item => {
            return {
                name: item.restaurant.name,
                address: item.restaurant.location.address,
                rating: item.restaurant.user_rating.aggregate_rating === 0 ? item.restaurant.user_rating.rating_text : item.restaurant.user_rating.aggregate_rating, 
                distance: geolib.getDistance(
                    {latitude: 38.728549, longitude: -9.152448},
                    {latitude: item.restaurant.location.latitude, longitude: item.restaurant.location.longitude}
                ) + " m"  
            }
        });
        router.get('/', (req,res) => res.send(both));       
    })
    .catch(err => {
        const resp = err;
        router.get('/', (req,res) => res.send(resp));
    }); 

    
module.exports = router;