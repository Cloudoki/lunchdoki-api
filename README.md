# lunchdoki-api
API for Lunch picking

## Project description
#### Context
The purpose of this small project is to develop a service that can be used through Slack, to help us pick places to have lunch.

#### Use case
Lunch hour is getting close, someone goes to slack and:

- Triggers the service with some command, like /showmethelunch
- It searches through Zomato's API which restaurantes are in the proximities (1km)
- Shows a list to the users in slack
- Users can vote on the restaurants, like a regular Slack /poll command