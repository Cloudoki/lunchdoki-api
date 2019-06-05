const express = require('express');
const axios = require('axios');
const geolib = require('geolib');
const uuid = require('uuid');
const datefns = require('date-fns')
const router = express.Router();

// Globals
let n = 1

// Template
const zmModel = require('../../models/z-basemodel')
const zmResponse = require('../../models/z-responsemodel')

// Zomato Options
const options = {
    method: 'GET',
    headers: { 'user-key': 'de4fa22b5fad42417f1e8041249ebdbb' },
    url: 'https://developers.zomato.com/api/v2.1/search?entity_id=82029&entity_type=subzone&lat=38.728579&lon=-9.152448&radius=1000&sort=real_distance&order=asc&count=5'
}


const createResponseModel = (restheader, res) => {
    const id = "my_unique_id_" + uuid()
    restheader.blocks[0].block_id = id

    const newResponse = new zmResponse({
        _id: id,
        slack_interface: restheader
    })
    newResponse.save()
    res.json(restheader)
    console.log("[Response]: Copy Created")


}

const zomatoRequest = () => {
    // Zomato Request
    return axios(options).then((resp) => {
        let i = 0
        // Slack - Restaurant Voting Options
        const restopt = resp.data.restaurants.map(item => {
            return {
                "text": {
                    "type": "plain_text",
                    "text": item.restaurant.name,
                    "emoji": true
                },
                "value": "value-" + (i++)
            }
        })

        // Slack  - Restaurant Info
        const restinfo = resp.data.restaurants.map(item => {
            return {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*" + item.restaurant.name + "*" + "\n" + item.restaurant.location.address + "\n" + "*Rating:* " +
                        (item.restaurant.user_rating.aggregate_rating === 0 ? item.restaurant.user_rating.rating_text : item.restaurant.user_rating.aggregate_rating) +
                        "\n" + "*Distance:* " +
                        geolib.getDistance(
                            { latitude: 38.728549, longitude: -9.152448 },
                            { latitude: item.restaurant.location.latitude, longitude: item.restaurant.location.longitude }
                        ) + " m" + "\n" +
                        "*Average Cost for Two*: " + item.restaurant.average_cost_for_two + item.restaurant.currency + "\n" +
                        "*Cuisines:* " + item.restaurant.cuisines
                },
                "accessory": {
                    "type": "image",
                    "image_url": item.restaurant.thumb || "https://via.placeholder.com/200x200.png?text=No+Image",
                    "alt_text": item.restaurant.name
                }
            }
        })

        // Slack - Full Response
        const restheader = {
            "response_type": "in_channel",
            "blocks":
                [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "*Hey <!everyone>* \n Here's a list of the closest restaurants in the area, shall we pick one?"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Which one?"
                        },
                        "accessory": {
                            "type": "static_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select a restaurant",
                                "emoji": true
                            },
                            "options": restopt
                        }
                    },
                    ...restinfo

                ]
        } 
        return restheader
    }).catch((err) => {
        // If there's an error
        console.log("Zomato API:", err)
        throw err
    })
}

// Zomato Request and DB Interaction
const zomatoDBOperations = (res) => {

    // DB Model Save/Update
    zmModel.find({ rid: n }, (err, docs) => {
        if (docs.length === 0) { // Se não haver documentos cria
            zomatoRequest().then((restheader) => {
                const riSave = new zmModel({
                    rid: n,
                    slack_interface: restheader
                })
                riSave.save()
                console.log("[/test]: Item added to the DB")

                createResponseModel(restheader,res)
                console.log("Success!")
            }).catch((err) => {
                // If there's an error
                console.log("Zomato API:", err)
                res.send(err)
            })

        } else {

            
            const updated = docs[0].updatedAt
            let diff = datefns.differenceInDays(new Date().toISOString(), updated)
            if (diff >= 7) { // Se já tiver passado uma semana - A base de dados leva update
                zomatoRequest().then(restheader => {
                    zmModel.updateOne({ rid: n }, { slack_interface: restheader, rid: n += 1 }, (err, res) => {
                        if (!err) return console.log("[/test]: Item succesfully updated - Last Update: %s days ago", diff)
                    })
                    createResponseModel(restheader,res)
                }).catch(err => {
                    console.log(err)
                    res.send(err)
                })
            }
            else { // Se ainda nao tiver passado uma semana retorna os dados salvos na base de dados
                console.log("[/test]: Request already present in the Database. Loaded instead")
                createResponseModel(docs[0].slack_interface, res)
                
            }

        }
    })

}

// Send Zomato Response to Slack and Save it in the Database
router.post('/', (req, res) => {
    zomatoDBOperations(res)
})
module.exports = router;