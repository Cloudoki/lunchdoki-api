const express = require('express');
const axios = require('axios');
const router = express.Router();

// Globals
let n = 0

// API Keys
const apiMapsKey = require('../../config/keys').apiMapsKey

// Mongoose - API Pool - Model
const zmRespModel = require('../../models/z-responsemodel');
const zmLocation = require('../../models/z-locationmodel');

const processPromptLocation = (res, payload) => {
    const rLocation = encodeURI(payload.submission.loc_input)
    const options = {
        method: "GET",
        headers: {"Content-Type":"application/json"},
        url: `https://maps.googleapis.com/maps/api/geocode/json?key=${apiMapsKey}&address=${rLocation}`
    }
    axios(options)
        .then((resp) => {
            res.send()
            // Add Location URL to Database
            zmLocation.find({gm_location_name: resp.data.results[0].formatted_address},(err,res) => {
                if(res.length === 0)
                {
                    const newLocation = new zmLocation({
                        loc_id: n,
                        gm_location_name: resp.data.results[0].formatted_address,
                        lat: resp.data.results[0].geometry.location.lat,
                        lng: resp.data.results[0].geometry.location.lng,
                        zomato_gen_url: `https://developers.zomato.com/api/v2.1/search?lat=${resp.data.results[0].geometry.location.lat}&lon=${resp.data.results[0].geometry.location.lng}&sort=real_distance&order=asc&count=${payload.submission.loc_count}`
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


        if (resp.slack_interface.blocks.length < 12) {
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
                let alt_text = block.text.text.match(/\*[\w!-. Ç-ñ|\ô]*\*/) // Retorna numa array qualquer expressão que esteja entre *, tenha qualquer caracter e um espaço
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
        n+=1
        processPromptLocation(res, payload)
    }
    else {
        let votes = {}
        postPayloadData(payload, votes, res)
    }

})

module.exports = router;
