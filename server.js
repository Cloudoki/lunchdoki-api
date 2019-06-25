const express = require('express')
const mongoose = require('mongoose')
const path = require('path')
const bodyParser = require('body-parser')
const app = express()

const config = require('./config')

// Body-Parser Middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// View Set
app.set('views',path.join(__dirname,'/views'))
app.set('view engine','pug')

// Routes
const places = require('./routes/api/places')
const hook = require('./routes/api/hook')
const access = require('./routes/api/access')

// Logger
const logger = require('./util/logger')

/**	
 * @returns {void}
 */
const start = () => {
	// Use Routes
	app.use('/places', places)
	app.use('/hook', hook)
	app.use('/access', access)
	app.use('/public', express.static(path.join(__dirname,'public')))
    
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
	.catch(err => logger.error(err))
