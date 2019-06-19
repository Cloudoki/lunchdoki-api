const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();

const config = require('./config')

// Body-Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

// DB Config
//const db = require('./config/keys').mongoURL

// Routes
const places = require('./routes/api/places');
const hook = require('./routes/api/hook');
const access = require('./routes/api/access');

// DB Connection
mongoose   
    .connect(config.get('db'), { useNewUrlParser: true, useFindAndModify: false})
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));

// Use Routes
app.use('/places', places);
app.use('/hook', hook);
app.use('/access', access);
 
// GET - HTTP Request based on a specific search in the API

app.listen(config.get('port'),() => {
    console.log('Server is running')    
});
