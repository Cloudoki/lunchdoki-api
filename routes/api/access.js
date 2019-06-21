const express = require('express')
const axios = require('axios')
const router = express.Router()
const logger = require('../../util/logger')

router.get('/',(req,res) => {

	const zmWorkspace = require('../../models/z-workspaces')
	const config = require('../../config')

	if(req.query.error) {
		return res.send('App not added to workspace.')
	}

	const options = {
		url: 'https://slack.com/api/oauth.access',
		method: 'POST',
		headers: {'Content-Type':'application/x-www-form-urlencoded'},
		data: `client_id=${config.get('keys').slack.client_id}&client_secret=${config.get('keys').slack.client_secret}&code=${req.query.code}`,
	}
	axios(options)
		.then(resp => {
			// Guarda o registo do workspace em que foi instalado ou verifica se já existe
			const newWorkspace = new zmWorkspace({
				workspace_id: resp.data.team_id,
				workspace_name: resp.data.team_name,
				channel_applied: resp.data.incoming_webhook.channel,
				access_token: resp.data.access_token,
			})
			newWorkspace.save()
			logger.info(resp.data)
			logger.info(`New workspace added: ${resp.data.team_name} on channel ${resp.data.incoming_webhook.channel}`)
			res.send(`New workspace added: ${resp.data.team_name} on channel ${resp.data.incoming_webhook.channel}`)
		})
		.catch(err => {
			logger.error(err)
			res.status(500).send('An error occurred')
		})

})

module.exports = router
