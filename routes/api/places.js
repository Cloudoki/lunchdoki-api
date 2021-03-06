const express = require('express')
const axios = require('axios')
const geolib = require('geolib')
const uuid = require('uuid')
const datefns = require('date-fns')
const router = express.Router()
const logger = require('../../util/logger')

// Template
const zmModel = require('../../models/z-basemodel')
const zmResponse = require('../../models/z-responsemodel')
const zmLocation = require('../../models/z-locationmodel')
const zmWorkspace = require('../../models/z-workspaces')

// API Keys
const config = require('../../config')
const zomatoAPIKey = config.get('keys').zomato

/**
 * Select workspace
 * @param {Object} req - request object
 * @returns {String|null} -
 */
const workspaceSelect = async (req) => {
	const resp = await zmWorkspace.find({ workspace_id: req.body.team_id })
	if (resp.length !== 0)
		return 'Bearer ' + resp[0].access_token
	else
		return null
}

/**
 * Check Available Locations
 * @param {Object} res - response object
 * @returns {String|null} -
 */
const checkAvailableLocations = async (res) => {

	try {
		const resp = await zmLocation.find({}, ['gm_location_name'], { sort: { loc_id: 1 } })

		if (resp.length === 0) {
			const teste = [
				{
					'label': 'No locations available',
					'value': 'No locations available',
				},
			]
			res.send()
			return teste
		}
		else {
			const results = resp.map(result => {
				const fresult = {
					'label': result.gm_location_name,
					'value': result.gm_location_name,
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

const apiSlackKey = config.get('keys').slack.key

// Zomato Options
/**
 * -
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @returns {void}
 */
const openConfigDialog = async (req, res) => {

	try {
		const available_location = await checkAvailableLocations(res)
		const workspace_select = await workspaceSelect(req)
		const options = {
			method: 'POST',
			url: 'https://slack.com/api/dialog.open',
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': (workspace_select !== null) ? workspace_select : apiSlackKey },
			data: {
				'token': req.body.token,
				'trigger_id': req.body.trigger_id,
				'dialog': {
					'callback_id': 'app-config',
					'title': 'Configurations',
					'submit_label': 'Apply',
					'elements': [
						{
							'type': 'text',
							'label': 'Location Defined',
							'name': 'loc_input',
							'hint': 'A street or specific coordinates',
							'placeholder': '7123 Greenrose Ave. Schererville, IN 46375',
							'optional': true,
						},
						{
							'type': 'select',
							'label': 'Available Locations',
							'name': 'loc_available',
							'hint': 'Recently added locations',
							'placeholder': 'Select a location',
							'optional': true,
							'options': available_location,
						},
						{
							'type': 'text',
							'subtype': 'number',
							'label': 'Result Count',
							'name': 'loc_count',
							'hint': 'Number of results shown. Default is 5.\n Maximum value is 10 \n Minimum value is 5',
							'placeholder': '5',
							'value': '5',
						},
						{
							'type': 'select',
							'label': 'Sorting',
							'name': 'loc_sorting',
							'hint': 'Sort results by user preference. Rating is ordered by the most rated',
							'value': 'Distance',
							'placeholder': 'Distance',
							'options': [
								{
									'label': 'Distance',
									'value': 'Distance',
								},
								{
									'label': 'Rating',
									'value': 'Rating',
								},
								{
									'label': 'Cost',
									'value': 'Cost',
								},
							],
						},
						{
							'type': 'select',
							'label': 'Average Cost',
							'name': 'loc_cost',
							'hint': 'Filter results by average cost',
							'placeholder': 'Select Range',
							'optional': true,
							'options': [
								{
									'label': 'Less than 10€',
									'value': 'Less than 10€',
								},
								{
									'label': '10€ to 25€',
									'value': '10€ to 25€',
								},
								{
									'label': '25€ to 40€',
									'value': '25€ to 40€',
								},
								{
									'label': 'More than 40€',
									'value': 'More than 40€',
								},
							],
						},
						{
							'type': 'text',
							'label': 'Search',
							'name': 'loc_search',
							'hint': 'Aditional Search',
							'optional': true,
							'placeholder': 'eg: Portuguese',
						},
					],
				},
			},
		}

		await axios(options)

	} catch (error) {
		throw (error)
	}
}

/**
 * -
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @returns {void}
 */
const sendHelpResp = (req, res) => {
	axios.post(req.body.response_url, {
		'blocks': [
			{
				'type': 'context',
				'elements': [
					{
						'type': 'mrkdwn',
						'text': '*Correct usage of /lunch*\n - */lunch* [config - Configuration Dialog]\n - */lunch with no parameters* - Default values defined in /lunch config',
					},
				],
			},
		],
	}).then(() => res.send())
}

/**
 * -
 * @param {Object} restheader - rest header
 * @param {Object} res - response object
 * @returns {void}
 */
const createResponseModel = (restheader, res) => {
	const id = 'my_unique_id_' + uuid()
	restheader.blocks[0].block_id = id

	const newResponse = new zmResponse({
		_id: id,
		slack_interface: restheader,
	})
	newResponse.save()
	res.json(restheader)
	logger.info('[Response]: Copy Created')

}

/**
 * -
 * @returns {Object} -
 */
const zomatoRequest = async () => {
	try {
		const loc_defined = await retrieveDefinedLocation()
		const finalURL = loc_defined.url
		const finalLocation = loc_defined.name
		const options = {
			method: 'GET',
			headers: { 'user-key': zomatoAPIKey },
			url: finalURL,
		}

		const resp = await axios(options)

		let i = 0
		let differ = ''
		const restopt = resp.data.restaurants.map(item => {

			// Evita restaurantes com nomes repetidos
			let j = 0
			if (differ !== item.restaurant.name)
				differ = item.restaurant.name
			else {
				j += 1
				differ = item.restaurant.name + ' (' + j + ')'
			}

			return {
				'text': {
					'type': 'plain_text',
					'text': differ,
					'emoji': true,
				},
				'value': 'value-' + (i++),
			}
		})

		const restinfo = resp.data.restaurants.map(item => {

			// Evita restaurantes com nomes repetidos
			let j = 0
			if (differ !== item.restaurant.name)
				differ = item.restaurant.name
			else {
				j += 1
				differ = item.restaurant.name + ' (' + j + ')'
			}

			return {
				'type': 'section',
				'text': {
					'type': 'mrkdwn',
					'text': ('<' + item.restaurant.url + '|*' + differ + '*>') + '\n' + item.restaurant.location.address + '\n' + '*Rating:* ' +
						(item.restaurant.user_rating.aggregate_rating === 0 ? item.restaurant.user_rating.rating_text : item.restaurant.user_rating.aggregate_rating) +
						'\n' + '*Distance:* ' +
						geolib.getDistance(
							{ latitude: loc_defined.lat, longitude: loc_defined.lng },
							{ latitude: item.restaurant.location.latitude, longitude: item.restaurant.location.longitude }
						) + ' m' + '\n' +
						'*Average Cost for Two*: ' + item.restaurant.average_cost_for_two + item.restaurant.currency + '\n' +
						'*Cuisines:* ' + item.restaurant.cuisines,
				},
				'accessory': {
					'type': 'image',
					'image_url': item.restaurant.thumb || 'https://via.placeholder.com/200x200.png?text=No+Image',
					'alt_text': differ,
				},
			}
		})
		let restheader = {
			'response_type': 'in_channel',
			'blocks':
				[{
					'type': 'section',
					'text': {
						'type': 'mrkdwn',
						'text': '*Hey <!everyone>* \n Here\'s a list of the closest restaurants in the area, shall we pick one?\n*' + finalLocation + '*',
					},
					'accessory': {
						'type': 'button',
						'text': {
							'type': 'plain_text',
							'text': 'Delete Poll',
							'emoji': true,
						},
						'value': '1',
					},
				},
				{
					'type': 'section',
					'text': {
						'type': 'mrkdwn',
						'text': 'Which one?',
					},
					'accessory': {
						'type': 'static_select',
						'placeholder': {
							'type': 'plain_text',
							'text': 'Select a restaurant',
							'emoji': true,
						},
						'options': restopt,
					},
				},
				...restinfo,

				],
		}
		return (resp.data.results_found > 5) ? restheader : restheader = {
			'response_type': 'in_channel',
			'blocks':
				[
					{
						'type': 'section',
						'text': {
							'type': 'mrkdwn',
							'text': 'Not enough results according to your *Search*',
						},
					},
				],
		}
	} catch (error) {
		throw (error)
	}

}

// Zomato Request and DB Interaction
/**
 * -
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @returns {void}
 */
const zomatoDBOperations = async (req, res) => {
	const workspace_select = await workspaceSelect(req)
	const locdefined = await retrieveDefinedLocation()
	const loc = (locdefined !== null) ? locdefined.name : null
	const urlParams = (locdefined !== null) ? locdefined.url.substring(locdefined.url.indexOf('?'), locdefined.url.length) : null
	// DB Model Save/Update
	zmModel.find({ location: loc, url_params: urlParams }, (err, docs) => {
		if (docs.length === 0) { // Se não haver documentos cria
			zomatoRequest().then((restheader) => {
				const riSave = new zmModel({
					location: loc,
					url_params: urlParams,
					slack_interface: restheader,
					created_by: req.body.user_id,
				})
				riSave.save()
				logger.info('[/test]: Item added to the DB')
				createResponseModel(restheader, res)
				logger.info('Success!')
			}).catch((err) => {
				// If there's an error
				if (err.constructor == TypeError) {
					const ops = {
						method: 'POST',
						url: 'https://slack.com/api/chat.postEphemeral',
						headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': (workspace_select !== null) ? workspace_select : apiSlackKey },
						data: {
							'user': req.body.user_id,
							'channel': req.body.channel_id,
							'text': '*Error:* Please define or select a location in the API configuration',
							'attachments': [
								{

									'text': 'Correct usage: /lunch config',
									'color': 'warning',
								},
							],
						},
					}

					axios(ops).then(() => { res.send() }).catch((err) => logger.error(err))

				} else {
					logger.info('Zomato API:', err)
					res.send(err)
				}
			})

		} else {

			const updated = docs[0].updatedAt
			let diff = datefns.differenceInDays(new Date().toISOString(), updated)
			if (diff >= 7) { // Se já tiver passado uma semana - A base de dados leva update
				zomatoRequest().then(restheader => {
					zmModel.updateOne({ location: loc, url_params: urlParams }, { slack_interface: restheader }, (err) => {
						if (!err) return logger.info('[/lunch]: Item succesfully updated - Last Update: %s days ago', diff)
					})
					createResponseModel(restheader, res)
				}).catch(err => {
					logger.error(err)
					res.send(err)
				})
			}
			else { // Se ainda nao tiver passado uma semana retorna os dados salvos na base de dados
				logger.info('[/lunch]: Request already present in the Database. Loaded instead')
				createResponseModel(docs[0].slack_interface, res)
			}

		}
	})

}

/**
 * -
 * @returns {void}
 */
const retrieveDefinedLocation = async () => {
	try {

		const resp = await zmLocation.findOne({ selected: true }, null, { sort: { loc_id: -1 } })
		if (resp !== null) {
			return {

				name: resp.gm_location_name,
				url: resp.zomato_gen_url,
				lat: resp.lat,
				lng: resp.lng,
			}
		} else {
			return null
		}

	} catch (err) {
		throw (err)

	}
}

// Send Zomato Response to Slack and Save it in the Database
router.post('/', (req, res) => {
	// Requests
	if (!req.body || (req.body && (!req.body.hasOwnProperty('text') || req.body.text == null))) {
		logger.debug(req.body, '[PLACES Empty Body]')
		return res.status(400).send('No body found')
	}
	switch (req.body.text) {
		case '': zomatoDBOperations(req, res); break
		case 'help': sendHelpResp(req, res); break
		case 'config': openConfigDialog(req, res); break
		default: {
			logger.debug(req.body, '[PLACES Invalid Operation]')
			res.status(400).send('Invalid Operation')
		} break
	}
})

module.exports = router
