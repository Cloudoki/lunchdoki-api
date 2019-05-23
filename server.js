const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const places = require('./routes/api/places');

// Body-Parser Middleware
app.use(bodyParser.json());

// Use Routes
app.use('/places', places);

// GET - HTTP Request based on a specific search in the API

app.listen(3000,() => {
    console.log('Server is running')    
});
