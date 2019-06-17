const express = require('express');
const axios = require('axios');
const geolib = require('geolib');
const uuid = require('uuid');
const datefns = require('date-fns')
const router = express.Router();

// Globals
let n = 0

// Template
const zmModel = require('../../models/z-basemodel')
const zmResponse = require('../../models/z-responsemodel')
const zmLocation = require('../../models/z-locationmodel')

// API Keys
const zomatoAPIKey = require('../../config/keys').apiZomatoKey

const checkAvailableLocations = async (res) => {

    try {
        const resp = await zmLocation.find({}, ['gm_location_name'], { sort: { loc_id: 1 } })

        if (resp.length === 0) {
            const teste = [
                {
                    "label": "No locations available",
                    "value": "No locations available"
                }
            ]
            res.send()
            return teste
        }
        else {
            const results = resp.map(result => {
                const fresult = {
                    "label": result.gm_location_name,
                    "value": result.gm_location_name
                }
                return fresult
            })
            res.send()
            return results

        }


    } catch (err) {
        throw (err)
    }
}

const apiSlackKey = require('../../config/keys').apiSlackKey

// Zomato Options
const openConfigDialog = async (req, res) => {

    try {

        const available_location = await checkAvailableLocations(res)
        const options = {
            method: 'POST',
            url: 'https://slack.com/api/dialog.open',
            headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": apiSlackKey },
            data: {
                "token": req.body.token,
                "trigger_id": req.body.trigger_id,
                "dialog": {
                    "callback_id": "app-config",
                    "title": "Configurations",
                    "submit_label": "Apply",
                    "elements": [
                        {
                            "type": "text",
                            "label": "Location Defined",
                            "name": "loc_input",
                            "hint": "A street or specific coordinates",
                            "placeholder": "7123 Greenrose Ave. Schererville, IN 46375",
                            "optional": true
                        },
                        {
                            "type": "select",
                            "label": "Available Locations",
                            "name": "loc_available",
                            "hint": "Recently added locations",
                            "placeholder": "Select a location",
                            "optional": true,
                            "options": available_location
                        },
                        {
                            "type": "text",
                            "subtype": "number",
                            "label": "Result Count",
                            "name": "loc_count",
                            "hint": "Number of results shown. Default is 5.\n Maximum value is 10 \n Minimum value is 5",
                            "placeholder": "5",
                            "value": "5",
                        },
                        {
                            "type": "select",
                            "label": "Sorting",
                            "name": "loc_sorting",
                            "hint": "Sort results by user preference. Rating is ordered by the most rated",
                            "value": "Distance",
                            "placeholder": "Distance",
                            "options": [
                                {
                                    "label": "Distance",
                                    "value": "Distance"
                                },
                                {
                                    "label": "Rating",
                                    "value": "Rating"
                                },
                                {
                                    "label": "Cost",
                                    "value": "Cost"
                                }
                            ]
                        },
                        {
                            "type": "select",
                            "label": "Average Cost",
                            "name": "loc_cost",
                            "hint": "Filter results by average cost",
                            "placeholder": "Select Range",
                            "optional": true,
                            "options": [
                                {
                                    "label": "Less than 10€",
                                    "value": "Less than 10€"
                                },
                                {
                                    "label": "10€ to 25€",
                                    "value": "10€ to 25€"
                                },
                                {
                                    "label": "25€ to 40€",
                                    "value": "25€ to 40€"
                                },
                                {
                                    "label": "More than 40€",
                                    "value": "More than 40€"
                                }
                            ]
                        },
                        {
                            "type": "text",
                            "label": "Search",
                            "name": "loc_search",
                            "hint": "Aditional Search",
                            "optional": true,
                            "placeholder": "eg: Portuguese"
                        }
                    ]
                }
            }
        }

        const resp = await axios(options)

        // Reset poll
        zmModel.deleteOne({}, (err, res) => {
            if (!err) return console.log("[Config]: Existed requests deleted")
        })
        zmResponse.deleteMany({}, (err, res) => {
            if (!err) return console.log("[Config]: Existed responses deleted")
        })

    } catch (error) {
        throw (error)
    }
}



const sendHelpResp = (req, res) => {
    axios.post(req.body.response_url, {
        "blocks": [
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "*Correct usage of /lunch*\n - */lunch* [config - Configuration Dialog]\n - */lunch with no parameters* - Default values defined in /lunch config"
                    }
                ]
            }
        ]
    }).then(() => res.send())
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

const zomatoRequest = async () => {
    try {
        const loc_defined = await retrieveDefinedLocation()
        const finalURL = loc_defined.url
        const options = {
            method: 'GET',
            headers: { 'user-key': zomatoAPIKey },
            url: finalURL
        }

        const resp = await axios(options)

        /*Cria uma exceção em caso de 5 ou menos resultados mostrados
        if(resp.data.results_found < 5) return {
            "text": "Not enough restaurants available according to your preferences"
        }*/

        let i = 0
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
        const restinfo = resp.data.restaurants.map(item => {
            return {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*" + item.restaurant.name + "*" + "\n" + item.restaurant.location.address + "\n" + "*Rating:* " +
                        (item.restaurant.user_rating.aggregate_rating === 0 ? item.restaurant.user_rating.rating_text : item.restaurant.user_rating.aggregate_rating) +
                        "\n" + "*Distance:* " +
                        geolib.getDistance(
                            { latitude: loc_defined.lat, longitude: loc_defined.lng },
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
        let restheader = {
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
        return (resp.data.results_found > 5) ? restheader : restheader = {
            "response_type": "in_channel",
            "blocks":
                [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Not enough results according to your *Search*"
                        }
                    }
                ]
        }
    } catch (error) {
        throw (error)
    }

}

// Zomato Request and DB Interaction
const zomatoDBOperations = (req, res) => {

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

                createResponseModel(restheader, res)
                console.log("Success!")
            }).catch((err) => {
                // If there's an error

                if (err.constructor == TypeError) {
                    const ops = {
                        method: "POST",
                        url: 'https://slack.com/api/chat.postEphemeral',
                        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": apiSlackKey },
                        data: {
                            "user": req.body.user_id,
                            "channel": req.body.channel_id,
                            "text": "*Error:* Please define or select a location in the API configuration",
                            "attachments": [
                                {

                                    "text": "Correct usage: /lunch config",
                                    "color": "warning"
                                }
                            ]
                        }
                    }
                    axios(ops).then((resp) => { res.send() }).catch((err) => console.log(err))

                } else {
                    console.log("Zomato API:", err)
                    res.send(err)
                }
            })

        } else {

            const updated = docs[0].updatedAt
            let diff = datefns.differenceInDays(new Date().toISOString(), updated)
            if (diff >= 7) { // Se já tiver passado uma semana - A base de dados leva update
                zomatoRequest().then(restheader => {
                    zmModel.updateOne({ rid: n }, { slack_interface: restheader, rid: n += 1 }, (err, res) => {
                        if (!err) return console.log("[/test]: Item succesfully updated - Last Update: %s days ago", diff)
                    })
                    createResponseModel(restheader, res)
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

const retrieveDefinedLocation = async () => {
    try {

        const resp = await zmLocation.findOne({ selected: true }, null, { sort: { loc_id: -1 } })
        return {
            url: resp.zomato_gen_url,
            lat: resp.lat,
            lng: resp.lng
        }
    } catch (err) {
        throw (err)
    }
}

// Send Zomato Response to Slack and Save it in the Database
router.post('/', (req, res) => {
    // Requests   
    switch (req.body.text) {
        case '': zomatoDBOperations(req, res); break;
        case 'help': sendHelpResp(req, res); break;
        case 'config': openConfigDialog(req, res); break;
    }
})
module.exports = router;
