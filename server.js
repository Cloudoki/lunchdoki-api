const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();

// Body-Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

// DB Config
const db = require('./config/keys').mongoURL

// Routes
const places = require('./routes/api/places');
const hook = require('./routes/api/hook');

// DB Connection
mongoose   
    .connect(db, { useNewUrlParser: true})
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));

// Use Routes
app.use('/places', places);
app.use('/hook', hook);
 
// GET - HTTP Request based on a specific search in the API

app.listen(3000,() => {
    console.log('Server is running')    
});
