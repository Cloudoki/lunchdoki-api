const convict = require('convict')

// Schema
const schema = require('./schema')
const config = convict(schema)

config.validate({allowed: 'ward'})

module.exports = config