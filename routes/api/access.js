const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/',(req,res) => {

    res.sendStatus(302)
    const zmWorkspace = require('../../models/z-workspaces')
    const config = require('../../config')

    const options = {
        url: "https://slack.com/api/oauth.access",
        method: "POST",
        headers: {"Content-Type":"application/x-www-form-urlencoded"},
        data: `client_id=${config.get('keys').slack.client_id}&client_secret=${config.get('keys').slack.client_secret}&code=${req.query.code}`
    }
    axios(options)
        .then(resp => {
            // Guarda o registo do workspace em que foi instalado ou verifica se já existe
            const newWorkspace = new zmWorkspace({
                workspace_id: resp.data.team_id,
                workspace_name: resp.data.team_name,
                channel_applied: resp.data.incoming_webhook.channel,
                access_token: resp.data.access_token
            })
            newWorkspace.save()
            console.log(resp.data)
            console.log(`New workspace added: ${resp.data.team_name} on channel ${resp.data.incoming_webhook.channel}`)
        })
        .catch(err => console.log(err))

})

module.exports = router;