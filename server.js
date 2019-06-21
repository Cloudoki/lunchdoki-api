const express = require('express')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const app = express()

const config = require('./config')

// Body-Parser Middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Routes
const places = require('./routes/api/places')
const hook = require('./routes/api/hook')
const access = require('./routes/api/access')
const logger = require('./util/logger')

/**
 * @returns {void}
 */
const start = () => {
	// Use Routes
	app.use('/places', places)
	app.use('/hook', hook)
	app.use('/access', access)
    
	// GET - HTTP Request based on a specific search in the API

	app.listen(config.get('port'),() => { 
		logger.info('Server is running')
	})
}

// DB Connection
mongoose   
	.connect(config.get('db'), { useNewUrlParser: true, useFindAndModify: false})
	.then(() => {
		logger.info('MongoDB Connected...')
		start()
	})
	.catch(err => logger.errorq(err))
