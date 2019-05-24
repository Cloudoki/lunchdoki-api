const express = require('express');
const axios = require('axios');
const geolib = require('geolib');
const router = express.Router();

const options = {
    method: 'GET',
    headers: {'user-key': 'de4fa22b5fad42417f1e8041249ebdbb'},
    url: 'https://developers.zomato.com/api/v2.1/search?entity_id=82029&entity_type=subzone&lat=38.728579&lon=-9.152448&radius=1000&sort=real_distance&order=asc'
}

// GET Request - Zomato API
router.get('/', (req,res) => {
    // Zomato Request 
    axios(options).then((resp) => {
        const rest = resp.data.restaurants.map(item => {
            return {
                name: item.restaurant.name,
                address: item.restaurant.location.address,
                rating: item.restaurant.user_rating.aggregate_rating === 0 ? item.restaurant.user_rating.rating_text : item.restaurant.user_rating.aggregate_rating, 
                distance: geolib.getDistance(
                    {latitude: 38.728549, longitude: -9.152448},
                    {latitude: item.restaurant.location.latitude, longitude: item.restaurant.location.longitude}
                ) + " m"  
            }
        })
        // Return a list of the nearest restaurants in Marquês de Pombal 
        res.json(rest)
    }).catch((err) => {
        // If there's an error
        console.log("Zomato API:", err)
        res.send(err)
    })    
})


// POST Request
router.post('/', (req,res) => {
    return res.json(
        [      
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Here's a list of the closest restaurants in the area",
                    "emoji": true
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "1st Restaurant",
                            "emoji": true
                        },
                        "value": "click_me_123"
                    }
                ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "2nd Restaurant",
                            "emoji": true
                        },
                        "value": "click_me_123"
                    }
                ]
            },
                {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "3nd Restaurant",
                            "emoji": true
                        },
                        "value": "click_me_123"
                    }
                ]
            }
        ]
    )
})
    
module.exports = router;