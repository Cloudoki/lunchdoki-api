const express = require('express')
const axios = require('axios')
const router = express.Router()
const logger = require('../../util/logger')

// API Keys
const config = require('../../config')
const apiMapsKey = config.get('keys').gmaps

// Mongoose - API Pool - Model
const zmRespModel = require('../../models/z-responsemodel')
const zmLocation = require('../../models/z-locationmodel')
const zmSearch = require('../../models/z-searchmodel')

/**
 * 
 * @param {String} sub -
 * @param {String} url -
 * @param {String} paramSample -
 * @param {Number} paramValue -
 * @returns {Object} -
 */
const filterInnerConfigurations = (sub, url, paramSample, paramValue) => {
	// paramSample é um excerto do url ligado ao paramValue
	// paramValue é o valor que tem de ser definido juntamente com o paramSample no finalURL
	// Esta função permite fazer a configuração de um ou mais filtros definidos como parametros de entrada
	if (typeof sub === 'object' && typeof paramSample === 'object' && typeof paramValue === 'object') {
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
		}
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

/**
 * 
 * @param {Object} payload -
 * @returns {String|null} -
 */
const getAverageCost = (payload) => {
	if (payload.submission.loc_cost !== null) {
		switch (payload.submission.loc_cost) {
			case 'Less than 10€': return '0'
			case '10€ to 25€': return '1'
			case '25€ to 40€': return '2'
			case 'More than 40€': return '3'
		}
	} else return null
}

/**
 * 
 * @param {Object} payload -
 * @returns {String|null} -
 */
const getSorting = (payload) => {
	if (payload.submission.loc_sorting !== null) {
		switch (payload.submission.loc_sorting) {
			case 'Distance': return 'real_distance asc'
			case 'Cost': return 'cost asc'
			case 'Rating': return 'rating desc'
		}
	} else return null
}

/**
 * 
 * @param {Object} payload -
 * @returns {Object} -
 */
const applyExistentFilters = (payload) => {
	// Defined filters
	let avgCost = getAverageCost(payload)
	let sorting = getSorting(payload)
	return {
		cft: avgCost,
		sort: sorting.substring(0, sorting.indexOf(' ')),
		order: sorting.substring(sorting.indexOf(' ') + 1, sorting.length),
	}
}


/**
 * 
 * @param {Object} res -
 * @param {Object} payload -
 * @returns {void} 
 */
const dialogValidations = async (res, payload) => {

	// Definição de um limite de items mostrados por votação
	if (payload.submission.loc_count > 10 || payload.submission.loc_count < 5) {
		res.send({
			'errors': [
				{
					'name': 'loc_count',
					'error': 'Typed value is above the limit or below the limit',
				},
			],
		})
		return false
	}

	// Criação de uma exceção para evitar que dois campos fiquem ambos vazios
	if (payload.submission.loc_input === null && payload.submission.loc_available === null) {
		res.send({
			'errors': [
				{
					'name': 'loc_input',
					'error': 'Both fields can\'t be empty. One must be filled',
				},
				{
					'name': 'loc_available',
					'error': 'Both fields can\'t be empty. One must be filled',
				},
			],

		})
		return false
	}

	if (payload.submission.loc_input !== null && payload.submission.loc_available !== null) {
		res.send({
			'errors': [
				{
					'name': 'loc_input',
					'error': 'Both fields can\'t be filled.',
				},
				{
					'name': 'loc_available',
					'error': 'Both fields can\'t be filled.',
				},
			],
		})
		return false
	}

	// Validação de conteúdo introduzido em 'Search'
	if (payload.submission.loc_search !== null) {
		const resp = await zmSearch.find({ search_value: payload.submission.loc_search })
		if (resp.length === 0) {
			const newSearch = new zmSearch({
				search_value: payload.submission.loc_search,
				date: new Date(),
				latest_user: payload.user.name,
			})
			newSearch.save()
		} else {
			const doc = await zmSearch.findOneAndUpdate({ search_value: resp[0].search_value }, { $inc: { searches: 1 } })
			logger.info(doc)
		}

	}

	return true

}

/**
 * 
 * @param {Object} res -
 * @param {Object} payload -
 * @returns {void}
 */
const selectExistentLocation = async (res, payload) => {

	const sLocation = payload.submission.loc_available
	const sCount = payload.submission.loc_count
	const sCFT = applyExistentFilters(payload).cft
	const sSort = applyExistentFilters(payload).sort
	const sOrder = applyExistentFilters(payload).order
	const sSearch = payload.submission.loc_search

	// Só uma localização pode ser selecionada as outras que tiverem sido anteriormente selecionada
	// voltam a ter o campo selected a false

	zmLocation.find({ selected: true, gm_location_name: { $ne: sLocation } }, (err, resp) => {
		if (resp.length !== 0) {
			zmLocation.updateMany({ gm_location_name: { $ne: sLocation } }, { selected: false }, (error) => {
				if (!error) return logger.info('[Location]: Selected state reset')
			})
		}
	})

	zmLocation.findOneAndUpdate({ gm_location_name: sLocation }, { selected: true }, (err, resp) => {

		// Adição/Substituição dos params Count,Sort e Order ao Link
		const countStr = resp.zomato_gen_url.substring(resp.zomato_gen_url.lastIndexOf('count'), resp.zomato_gen_url.length)
		const sortStr = resp.zomato_gen_url.substring(resp.zomato_gen_url.indexOf('sort'), resp.zomato_gen_url.indexOf('order') - 1)
		const orderStr = resp.zomato_gen_url.substring(resp.zomato_gen_url.indexOf('order'), resp.zomato_gen_url.indexOf('count') - 1)
		// Faz as devidas configurações aos filtros existentes e retorna um link final
		const finalLink = filterInnerConfigurations([sortStr, orderStr, countStr, null, null], resp.zomato_gen_url, ['sort=', 'order=', 'count=', '&cft=', '&q='], [sSort, sOrder, sCount, sCFT, sSearch])
		logger.info(finalLink)
		if (!err) {
			logger.info('[Location]: New selected location detected: ', payload.submission.loc_available)
			zmLocation.updateOne({ gm_location_name: sLocation }, { $set: { zomato_gen_url: finalLink } }, (err) => {
				if (!err) return logger.info('[Location]: Count updated')
			})
		}
	})
	res.send()
}

/**
 * 
 * @param {Object} res -
 * @param {Object} payload -
 * @returns {void}
 */
const processPromptLocation = (res, payload) => {

	// Coloca o campo select das outras localizações já existentes a false
	zmLocation.find({ selected: true }, (err) => {
		zmLocation.updateMany({}, { selected: false }, () => {
			if (!err) return logger.info('[Location]: Selected state reset on those who had it true')
		})
	})

	const rLocation = encodeURI(payload.submission.loc_input)
	const rAverageCost = (applyExistentFilters(payload).cft !== null) ? ('&cft=' + applyExistentFilters(payload).cft) : ''
	const rSearch = (payload.submission.loc_search !== null) ? ('&q=' + payload.submission.loc_search) : ''
	const rSort = applyExistentFilters(payload).sort
	const rOrder = applyExistentFilters(payload).order
	const options = {
		method: 'GET',
		headers: { 'Content-Type': 'application/json' },
		url: `https://maps.googleapis.com/maps/api/geocode/json?key=${apiMapsKey}&address=${rLocation}`,
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
						zomato_gen_url: `https://developers.zomato.com/api/v2.1/search?lat=${resp.data.results[0].geometry.location.lat}&lon=${resp.data.results[0].geometry.location.lng}&radius=1000&sort=${rSort}&order=${rOrder}&count=${payload.submission.loc_count}${rAverageCost}${rSearch}`,
						selected: true,
					})
					newLocation.save()
				}
			})
		})
		.catch((err) => logger.error(err))
}

/**
 * 
 * @param {Object} payload -
 * @param {Array} vot -
 * @param {Object} res -
 * @returns {void}
 */
const postPayloadData = (payload, vot, res) => {
	zmRespModel.findById(payload.message.blocks[0].block_id, (err, resp) => {
		if (resp !== null) {
			const selectedOption = payload.actions[0].selected_option.text.text
			resp.slack_interface.blocks = resp.slack_interface.blocks.map(block => {
				if (block.accessory && block.accessory.alt_text) {
					// eslint-disable-next-line no-useless-escape
					let alt_text = block.text.text.match(/\<@[\w]*\>/g)
					// Retorna um array com a indicação de qual foi o voto anterior, baseado numa expressão que esteja entre < >, tenha um @ e qualquer caracter incluido
					vot[block.accessory.alt_text] = (alt_text || []).length

				}

				if (block.text.text) { // Evita que um usuario vote em mais do que uma opção
					if (block.text.text.indexOf(payload.user.id) !== -1) {
						const newblock = block.text.text.replace('\n' + '<@' + payload.user.id + '>', '')
						block.text.text = newblock
						vot[block.accessory.alt_text] -= 1
						logger.info('Mudança de voto')
					}
					else {
						if (block.accessory && block.accessory.alt_text && block.accessory.alt_text === selectedOption) {
							vot[block.accessory.alt_text] += 1
							block.text.text += ('\n' + '<@' + payload.user.id + '>')
							logger.info('Voto Adicionado')
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
							type: 'section',
							block_id: String(resp.slack_interface.blocks.length),
							text: {
								'type': 'mrkdwn',
								'text': '*' + block.accessory.alt_text + '*' + ' - Votes: ' + vot[block.accessory.alt_text],
							},
						})
				})
			}

			resp.slack_interface.blocks = resp.slack_interface.blocks.map(block => {
				if (block.block_id >= 7) {
					// eslint-disable-next-line no-useless-escape
					let alt_text = block.text.text.match(/\*[A-zÀ-ÿ* |!-.\—\d]*\*/) // Retorna numa array qualquer expressão que esteja entre *, tenha qualquer caracter e um espaço
					if (alt_text) alt_text = alt_text[0].replace(/\*/gi, '') // Substitui todos os asteriscos por nada (remove todos os asteriscos)
					block = {
						type: block.type,
						block_id: block.block_id,
						text: {
							type: block.text.type,
							text: `*${alt_text}* - Votes: ${vot[alt_text]}`,
						},
					}

				}
				return block
			})

			zmRespModel.updateOne({ _id: payload.message.blocks[0].block_id }, {
				$push: {
					history: {
						user_id: payload.user.id,
						voted_option: payload.actions[0].selected_option.text.text,
					},
				},
				slack_interface: resp.slack_interface,
			}, (err) => {
				if (!err) return logger.info('[Response]: Document modified, vote inserted')
			})

			if (!err) return axios.post(payload.response_url, resp.slack_interface)
				.then((respon) => res.json(respon.data)).catch(err => logger.error(err))
		} else {
			return axios.post(payload.response_url, { 'text': 'Closed poll. Votes are no longer acceptable' })
				.then(() => logger.info('[Closed Poll]: A poll was disabled')).catch(err => logger.error(err))
		}
	})

}


// POST - Option Click
router.post('/', async (req, res) => {
	let payload
	try {
		payload = JSON.parse(req.body.payload)
	} catch (error) {
		payload = null
	}

	if (typeof payload.callback_id != 'undefined') {
		const isValid = await dialogValidations(res, payload)
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

module.exports = router

// Fix It: Allow users to filter results by Rating

