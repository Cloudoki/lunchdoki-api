const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();

// Body-Parser Middleware
app.use(bodyParser.json());

const options = {
    method: 'GET',
    headers: {'user-key': 'de4fa22b5fad42417f1e8041249ebdbb'},
    url: 'https://developers.zomato.com/api/v2.1/locations?query=Jakarta'
}

// GET - HTTP Request based on a specific search in the API
axios(options)
    .then((res) => {
        const resp = res.data;
        app.get('/',(req,res) => res.send(resp));
    })
    .catch(err => {
        const resp = err;
        app.get('/',(req,res) => res.send(resp));
    });

app.listen(3000,() => {
    console.log('Server is running')
});
