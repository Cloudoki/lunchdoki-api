const express = require('express');
const axios = require('axios');
const router = express.Router();

// API Keys
const apiMapsKey = require('../../config/keys').apiMapsKey

// Mongoose - API Pool - Model
const zmRespModel = require('../../models/z-responsemodel');
const zmLocation = require('../../models/z-locationmodel');
const zmSearch = require('../../models/z-searchmodel');

const filterInnerConfigurations = (sub, url, paramSample, paramValue) => {
    // paramSample é um excerto do url ligado ao paramValue
    // paramValue é o valor que tem de ser definido juntamente com o paramSample no finalURL
    // Esta função permite fazer a configuração de um ou mais filtros definidos como parametros de entrada
    if (typeof sub === "object" && typeof paramSample === "object" && typeof paramValue === "object") {
        let finalURL = url
        for (let i = 0; i < sub.length; i++) {
            if (sub[i] !== null) {
                finalURL = finalURL.replace(sub[i], paramSample[i] + paramValue[i])
            } else {
                if (!finalURL.includes(paramSample[i])) {
                    if (paramValue[i] !== null)
                        finalURL = [finalURL + paramSample[i] + paramValue[i]].join()
                } else {
                    const remadeSubstring = finalURL.substring(finalURL.lastIndexOf(paramSample[i]), finalURL.length)
                    finalURL = finalURL.replace(remadeSubstring, paramSample[i] + paramValue[i])
                }
            }
        };
        return finalURL
    } else {

        if (sub !== null) { // Verifica se a substring introduzida como parametro de facto existe
            const finalURL = url.replace(sub, paramSample + paramValue)
            return finalURL
        } else {
            if (!url.includes(paramSample)) {
                const finalURL = [url + paramSample + paramValue].join()
                return finalURL
            } else {
                const remadeSubstring = url.substring(url.lastIndexOf(paramSample), url.length)
                const finalURL = url.replace(remadeSubstring, paramSample + paramValue)
                return finalURL
            }
        }
    }
}

const getAverageCost = (payload) => {
    if (payload.submission.loc_cost !== null) {
        switch (payload.submission.loc_cost) {
            case 'Less than 10€': return "0";
            case '10€ to 25€': return "1";
            case '25€ to 40€': return "2";
            case 'More than 40€': return "3";
        }
    } else return null
}

const applyExistentFilters = (payload) => {
    // Defined filters
    let avgCost = getAverageCost(payload)
    return {
        cft: avgCost
    }
}

const dialogValidations = async (res, payload, search) => {

    // Definição de um limite de items mostrados por votação
    if (payload.submission.loc_count > 10 || payload.submission.loc_count < 5) {
        res.send({
            "errors": [
                {
                    "name": "loc_count",
                    "error": "Typed value is above the limit or below the limit"
                }
            ]
        })
        return false
    }

    // Validação de conteúdo introduzido em "Prefered Cuisines"
    if (payload.submission.loc_cuisines !== null) {
        let reg = new RegExp('\\b(\\w*' + payload.submission.loc_cuisines + '\\w*)\\b', 'g')
        const resp = await zmSearch.find({ category: "Cuisine", alias: { $regex: reg } })
        if (resp.length === 0) {
            res.send({
                "errors": [
                    {
                        "name": "loc_cuisines",
                        "error": "Invalid cuisine"
                    }
                ]
            })
            return false
        } else {
            payload.submission.loc_cuisines = resp[0].name
            const doc = await zmSearch.findOneAndUpdate({ name: resp[0].name }, { $inc: {searches: 1} })
            console.log(doc)
        }

    }

    // Criação de uma exceção para evitar que dois campos fiquem ambos vazios
    if (payload.submission.loc_input === null && payload.submission.loc_available === null) {
        res.send({
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
        return false
    }

    return true

}

const selectExistentLocation = async (res, payload) => {

    const sLocation = payload.submission.loc_available
    const sCount = payload.submission.loc_count
    const sCFT = applyExistentFilters(payload).cft
    const sCuisine = payload.submission.loc_cuisines

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
        // Adicição/Substituição do param Count ao Link
        const countStr = resp.zomato_gen_url.substring(resp.zomato_gen_url.lastIndexOf("count"), resp.zomato_gen_url.length)
        // Faz as devidas configurações aos filtros existentes e retorna um link final
        const finalLink = filterInnerConfigurations([countStr, null, null], resp.zomato_gen_url, ["count=", "&cft=", "&q="], [sCount, sCFT, sCuisine])
        console.log(finalLink)
        if (!err) {
            console.log("[Location]: New selected location detected: ", payload.submission.loc_available)
            zmLocation.updateOne({ gm_location_name: sLocation }, { $set: { zomato_gen_url: finalLink } }, (err, response) => {
                if (!err) return console.log("[Location]: Count updated")
            })
        }
    })
    res.send()
}

const processPromptLocation = (res, payload) => {

    // Coloca o campo select das outras localizações já existentes a false
    zmLocation.find({ selected: true }, (err, res) => {
        zmLocation.updateMany({}, { selected: false }, (error, resp) => {
            if (!err) return console.log("[Location]: Selected state reset on those who had it true")
        })
    })

    const rLocation = encodeURI(payload.submission.loc_input)
    const rAverageCost = (applyExistentFilters(payload).cft !== null) ? ("&cft=" + applyExistentFilters(payload).cft) : ''
    const rCuisine = (payload.submission.loc_cuisines !== null) ? ("&q=" + payload.submission.loc_cuisines) : ''
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
                        zomato_gen_url: `https://developers.zomato.com/api/v2.1/search?lat=${resp.data.results[0].geometry.location.lat}&lon=${resp.data.results[0].geometry.location.lng}&radius=1000&sort=real_distance&order=asc&count=${payload.submission.loc_count}${rAverageCost}${rCuisine}`,
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

        // Variavel que devolve o numero de restaurantes listados na votação
        const numbers = resp.slack_interface.blocks.filter(block => {
            if (!block.block_id)
                return block
        })

        if (resp.slack_interface.blocks.length <= (numbers.length - 1) + 2) {
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
                let alt_text = block.text.text.match(/\*[A-zÀ-ÿ* |!-.\–]*\*/) // Retorna numa array qualquer expressão que esteja entre *, tenha qualquer caracter e um espaço
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
router.post("/", async (req, res) => {
    let payload
    try {
        payload = JSON.parse(req.body.payload)
    } catch (error) {
        payload = null
    }


    if (typeof payload.callback_id != "undefined") {
        const isValid = await dialogValidations(res, payload, search)
        if (isValid) {
            if (payload.submission.loc_input === null && payload.submission.loc_available !== null)
                selectExistentLocation(res, payload)
            else if (payload.submission.loc_available === null && payload.submission.loc_input !== null)
                processPromptLocation(res, payload)
        }
        res.send()
    } else {
        let votes = {}
        postPayloadData(payload, votes, res)
    }

})

module.exports = router;

// Fix It: Allow users to filter results by Rating

