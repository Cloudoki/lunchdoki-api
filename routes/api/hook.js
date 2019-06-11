const express = require('express');
const axios = require('axios');
const router = express.Router();

// API Keys
const apiMapsKey = require('../../config/keys').apiMapsKey

// Mongoose - API Pool - Model
const zmRespModel = require('../../models/z-responsemodel');
const zmLocation = require('../../models/z-locationmodel');


const handleMaximumCount = (res,payload) => {
    return res.send({
        "errors": [
            {
                "name": "loc_count",
                "error": "Typed value is above the limit"
            }
        ]
    })
}

const handleNullException = (res, payload) => {
    return res.send({
        "errors": [
            {
                "name": "loc_input",
                "error": "Both fields can't be empty. One must be filled"
            },
            {
                "name": "loc_available",
                "error": "Both fields can't be empty. One must be filled"
            }
        ]

    })
}

const selectExistentLocation = (res, payload) => {

    const sLocation = payload.submission.loc_available
    const sCount = payload.submission.loc_count
    // Só uma localização pode ser selecionada as outras que tiverem sido anteriormente selecionada
    // voltam a ter o campo selected a false
    zmLocation.find({ selected: true, gm_location_name: { $ne: sLocation } }, (err, resp) => {
        if (resp.length !== 0) {
            zmLocation.updateMany({ gm_location_name: { $ne: sLocation } }, { selected: false }, (error, respon) => {
                if (!error) return console.log("[Location]: Selected state reset")
            })
        }
    })


    zmLocation.findOneAndUpdate({ gm_location_name: sLocation }, { selected: true }, (err, resp) => {
        const countStr = resp.zomato_gen_url.substring(resp.zomato_gen_url.lastIndexOf("count"), resp.zomato_gen_url.length)
        const modifiedLink = resp.zomato_gen_url.replace(countStr, "count=" + sCount)
        if (!err) {
            console.log("[Location]: New selected location detected: ", payload.submission.loc_available)
            zmLocation.updateOne({ gm_location_name: sLocation }, { $set: { zomato_gen_url: modifiedLink } }, (err, response) => {
                if (!err) return console.log("[Location]: Count updated")
            })
        }
    })
    res.send()
}

const processPromptLocation = (res, payload) => {
    const rLocation = encodeURI(payload.submission.loc_input)
    const options = {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        url: `https://maps.googleapis.com/maps/api/geocode/json?key=${apiMapsKey}&address=${rLocation}`
    }
    axios(options)
        .then((resp) => {
            res.send()
            // Add Location URL to Database
            zmLocation.find({ gm_location_name: resp.data.results[0].formatted_address }, (err, res) => {
                if (res.length === 0) {
                    const newLocation = new zmLocation({
                        gm_location_name: resp.data.results[0].formatted_address,
                        lat: resp.data.results[0].geometry.location.lat,
                        lng: resp.data.results[0].geometry.location.lng,
                        zomato_gen_url: `https://developers.zomato.com/api/v2.1/search?lat=${resp.data.results[0].geometry.location.lat}&lon=${resp.data.results[0].geometry.location.lng}&sort=real_distance&order=asc&count=${payload.submission.loc_count}`,
                        selected: true
                    })
                    newLocation.save()
                }
            })
        })
        .catch((err) => console.log(err))
}

const postPayloadData = (payload, vot, res) => {
    zmRespModel.findById(payload.message.blocks[0].block_id, (err, resp) => {
        const selectedOption = payload.actions[0].selected_option.text.text
        resp.slack_interface.blocks = resp.slack_interface.blocks.map(block => {
            if (block.accessory && block.accessory.alt_text) {
                let alt_text = block.text.text.match(/\<@[\w]*\>/g)
                // Retorna um array com a indicação de qual foi o voto anterior, baseado numa expressão que esteja entre < >, tenha um @ e qualquer caracter incluido
                vot[block.accessory.alt_text] = (alt_text || []).length

            }

            if (block.text.text) { // Evita que um usuario vote em mais do que uma opção
                if (block.text.text.indexOf(payload.user.id) !== -1) {
                    const newblock = block.text.text.replace("\n" + "<@" + payload.user.id + ">", "")
                    block.text.text = newblock
                    vot[block.accessory.alt_text] -= 1
                    console.log("Mudança de voto")
                }
                else {
                    if (block.accessory && block.accessory.alt_text && block.accessory.alt_text === selectedOption) {
                        vot[block.accessory.alt_text] += 1
                        block.text.text += ("\n" + "<@" + payload.user.id + ">")
                        console.log("Voto Adicionado")
                    }
                }
                return block
            }
            if (block.block_id) { // Adiciona o campo block_id para identificar a votação
                return block
            }
        })


        if (resp.slack_interface.blocks.length <= 12) {
            resp.slack_interface.blocks.map((block) => {
                if (block.accessory && block.accessory.alt_text)
                    resp.slack_interface.blocks.push({
                        type: "section",
                        block_id: String(resp.slack_interface.blocks.length),
                        text: {
                            "type": "mrkdwn",
                            "text": "*" + block.accessory.alt_text + "*" + " - Votes: " + vot[block.accessory.alt_text]
                        }
                    })
            })
        }

        resp.slack_interface.blocks = resp.slack_interface.blocks.map(block => {
            if (block.block_id >= 7) {
                let alt_text = block.text.text.match(/\*[A-zÀ-ÿ* |!-.]*\*/) // Retorna numa array qualquer expressão que esteja entre *, tenha qualquer caracter e um espaço
                if (alt_text) alt_text = alt_text[0].replace(/\*/gi, '') // Substitui todos os asteriscos por nada (remove todos os asteriscos)
                block = {
                    type: block.type,
                    block_id: block.block_id,
                    text: {
                        type: block.text.type,
                        text: `*${alt_text}* - Votes: ${vot[alt_text]}`
                    }
                }

            }
            return block
        })

        zmRespModel.updateOne({ _id: payload.message.blocks[0].block_id }, {
            $push: {
                history: {
                    user_id: payload.user.id,
                    voted_option: payload.actions[0].selected_option.text.text
                }
            },
            slack_interface: resp.slack_interface
        }, (err, raw) => {
            if (!err) return console.log("[Response]: Document modified, vote inserted")
        })

        if (!err) return axios.post(payload.response_url, resp.slack_interface)
            .then((respon) => res.json(respon.data)).catch(err => console.log(err))
    })
}


// POST - Option Click
router.post("/", (req, res) => {
    let payload
    try {
        payload = JSON.parse(req.body.payload)
    } catch (error) {
        payload = null
    }

    if (typeof payload.callback_id != "undefined") {

        if (payload.submission.loc_count > 10) 
            handleMaximumCount(res, payload)
        else if (payload.submission.loc_input === null && payload.submission.loc_available !== null)
            selectExistentLocation(res, payload)
        else if (payload.submission.loc_available === null && payload.submission.loc_input !== null)
            processPromptLocation(res, payload)
        else if (payload.submission.loc_input === null && payload.submission.loc_available === null)
            handleNullException(res, payload)
    }
    else {
        let votes = {}
        postPayloadData(payload, votes, res)
    }

})

module.exports = router;

// Fix It: Lista de Votação só aparece numa votacão com 9 ou menos items
///