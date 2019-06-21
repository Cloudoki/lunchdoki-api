const mongoose = require('mongoose')
const Schema = mongoose.Schema

const zWorkspaceSchema = new Schema({
	workspace_id: String,
	workspace_name: String,
	channel_applied: String,
	access_token: String,
})

// eslint-disable-next-line no-undef
module.exports = zmWorkspace = mongoose.model('zm-workspaces', zWorkspaceSchema)
